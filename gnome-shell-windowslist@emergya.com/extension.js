/**
 * extension.js
 * Copyright (C) 2011, Junta de Andalucía <devmaster@guadalinex.org>
 * 
 * This file is part of Guadalinex
 * 
 * This software is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 * 
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * As a special exception, if you link this library with other files to
 * produce an executable, this library does not by itself cause the
 * resulting executable to be covered by the GNU General Public License.
 * This exception does not however invalidate any other reasons why the
 * executable file might be covered by the GNU General Public License.
 * 
 * Authors:: Antonio Hernández (mailto:ahernandez@emergya.com)
 * 
 */

const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const St = imports.gi.St;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Gettext = imports.gettext.domain('gnome-shell');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Overview = imports.ui.overview;
const Tweener = imports.ui.tweener;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const AltTab = imports.ui.altTab;


function AppMenuButtonAlt(app) {
    this._init(app);
}

AppMenuButtonAlt.prototype = {
    __proto__: Panel.AppMenuButton.prototype,

    _init: function(app) {
        PanelMenu.Button.prototype._init.call(this, 0.0);
        this._metaDisplay = global.screen.get_display();
        this._startingApps = [];

        this._targetApp = app;

        let bin = new St.Bin({ name: 'appMenu' });
        this.actor.set_child(bin);

        this.actor.reactive = false;
        this._targetIsCurrent = false;

        this._container = new Shell.GenericContainer();
        bin.set_child(this._container);
        this._container.connect('get-preferred-width', Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height', Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));

        this._iconBox = new Shell.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this._container.add_actor(this._iconBox);
        this._label = new Panel.TextShadower();
        this._container.add_actor(this._label.actor);

        this._iconBottomClip = 0;

//        this._quitMenu = new PopupMenu.PopupMenuItem('');
//        this.menu.addMenuItem(this._quitMenu);
//        this._quitMenu.connect('activate', Lang.bind(this, this._onQuit));
        
        // TODO: Disconnect signals
//        this.menu = null;
//        this.menu = new PopupMenu.PopupMenu(this.actor, menuAlignment, St.Side.TOP, 0);
        

        this._visible = !Main.overview.visible;
        if (!this._visible)
            this.actor.hide();
        Main.overview.connect('hiding', Lang.bind(this, function () {
            this.show();
        }));
        Main.overview.connect('showing', Lang.bind(this, function () {
            this.hide();
        }));

        this._stop = true;

        this._spinner = new Panel.AnimatedIcon('process-working.svg',
                                         Panel.PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();

        
        let tracker = Shell.WindowTracker.get_default();
        tracker.connect('notify::focus-app', Lang.bind(this, this._sync));
        //tracker.connect('app-state-changed', Lang.bind(this, this._onAppStateChanged));
        

        global.window_manager.connect('switch-workspace', Lang.bind(this, this._sync));

        this._sync();
    },

    _sync: function() {
    	
    	/*
        let tracker = Shell.WindowTracker.get_default();
        let lastStartedApp = null;
        let workspace = global.screen.get_active_workspace();
        for (let i = 0; i < this._startingApps.length; i++)
            if (this._startingApps[i].is_on_workspace(workspace))
                lastStartedApp = this._startingApps[i];

        let focusedApp = tracker.focus_app;

        if (!focusedApp) {
            // If the app has just lost focus to the panel, pretend
            // nothing happened; otherwise you can't keynav to the
            // app menu.
            if (global.stage_input_mode == Shell.StageInputMode.FOCUSED)
                return;
        }
        */

        //let targetApp = focusedApp != null ? focusedApp : lastStartedApp;
        let targetApp = this._targetApp;
//        try {
//        	global.log(targetApp.get_name());
//        } catch(e) {
//        	global.logError(e);
//        }

        /*
        if (targetApp == null) {
            if (!this._targetIsCurrent)
                return;

            this.actor.reactive = false;
            this._targetIsCurrent = false;

            Tweener.removeTweens(this.actor);
            Tweener.addTween(this.actor, { opacity: 0,
                                           time: Overview.ANIMATION_TIME,
                                           transition: 'easeOutQuad' });
            return;
        }
        */

        if (!this._targetIsCurrent) {
            this.actor.reactive = true;
            this._targetIsCurrent = true;

            Tweener.removeTweens(this.actor);
            Tweener.addTween(this.actor, { opacity: 255,
                                           time: Overview.ANIMATION_TIME,
                                           transition: 'easeOutQuad' });
        }

        /*
        if (targetApp == this._targetApp) {
            if (targetApp && targetApp.get_state() != Shell.AppState.STARTING)
                this.stopAnimation();
            return;
        }
        */

        this._spinner.actor.hide();
        if (this._iconBox.child != null)
            this._iconBox.child.destroy();
        this._iconBox.hide();
        this._label.setText('');

        this._targetApp = targetApp;
        let icon = targetApp.get_faded_icon(2 * Panel.PANEL_ICON_SIZE);

        this._label.setText(targetApp.get_name());
        // TODO - _quit() doesn't really work on apps in state STARTING yet
//        this._quitMenu.label.set_text(_("Quit %s").format(targetApp.get_name()));

        this._iconBox.set_child(icon);
        this._iconBox.show();

        if (targetApp.get_state() == Shell.AppState.STARTING)
            this.startAnimation();

        this.emit('changed');
    },
    
    getApplication: function() {
        return this._targetApp;
    },
    
    getWindows: function() {
		let windows = this._targetApp.get_windows();
		return windows;
    },
    
    _onQuit: function() {
    	
    }
};

Signals.addSignalMethods(AppMenuButtonAlt.prototype);

function ThumbnailsPopup(appMenuButtonAlt) {
    this._init(appMenuButtonAlt);
}

ThumbnailsPopup.prototype = {
    _init : function(appMenuButtonAlt) {
        this.actor = new Shell.GenericContainer({ name: 'altTabPopup',
                                                  reactive: true,
                                                  visible: false });

        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        this._haveModal = false;

        this._currentApp = 0;
        this._currentWindow = -1;
        this._thumbnailTimeoutId = 0;
        this._motionTimeoutId = 0;
        this._appMenuButtonAlt = appMenuButtonAlt;

        this.thumbnailsVisible = false;

        // Initially disable hover so we ignore the enter-event if
        // the switcher appears underneath the current pointer location
        this._disableHover();

        Main.uiGroup.add_actor(this.actor);
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        alloc.min_size = global.screen_width;
        alloc.natural_size = global.screen_width;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        alloc.min_size = global.screen_height;
        alloc.natural_size = global.screen_height;
    },

    _allocate: function (actor, box, flags) {
        let childBox = new Clutter.ActorBox();
        let primary = global.get_primary_monitor();

        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);
        let bottomPadding = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
        let vPadding = this.actor.get_theme_node().get_vertical_padding();
        let hPadding = leftPadding + rightPadding;

        // Allocate the appSwitcher
        // We select a size based on an icon size that does not overflow the screen
        let [childMinHeight, childNaturalHeight] = this._appSwitcher.actor.get_preferred_height(primary.width - hPadding);
        let [childMinWidth, childNaturalWidth] = this._appSwitcher.actor.get_preferred_width(childNaturalHeight);
        childBox.x1 = Math.max(primary.x + leftPadding, primary.x + Math.floor((primary.width - childNaturalWidth) / 2));
        childBox.x2 = Math.min(primary.x + primary.width - hPadding, childBox.x1 + childNaturalWidth);
        childBox.y1 = primary.y + Math.floor((primary.height - childNaturalHeight) / 2);
        
        let [childMinHeight, childNaturalHeight] = this._appSwitcher.actor.get_children()[0].get_preferred_height(-1);
        childBox.y2 = childBox.y1 + childNaturalHeight;
//        global.log("Y2 = "+childBox.y2+", Y1 = "+childBox.y1+", childNaturalHeight = "+childNaturalHeight);
        
        this._appSwitcher.addClones(primary.height - bottomPadding - childBox.y1);
        this._appSwitcher.actor.allocate(childBox, flags);

        // Allocate the thumbnails
        // We try to avoid overflowing the screen so we base the resulting size on
        // those calculations
//        if (this._thumbnails || 1 == 0) {
//            let icon = this._appIcons[this._currentApp].actor;
//            // Force a stage relayout to make sure we get the correct position
//            global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, 0, 0);
//            let [posX, posY] = icon.get_transformed_position();
//            let thumbnailCenter = posX + icon.width / 2;
//            let [childMinWidth, childNaturalWidth] = this._appSwitcher.actor.get_preferred_width(-1);
//            childBox.x1 = Math.max(primary.x + leftPadding, Math.floor(thumbnailCenter - childNaturalWidth / 2));
//            if (childBox.x1 + childNaturalWidth > primary.x + primary.width - hPadding) {
//                let offset = childBox.x1 + childNaturalWidth - primary.width + hPadding;
//                childBox.x1 = Math.max(primary.x + leftPadding, childBox.x1 - offset - hPadding);
//            }
//
//            let spacing = this.actor.get_theme_node().get_length('spacing');
//
//            childBox.x2 = childBox.x1 +  childNaturalWidth;
//            if (childBox.x2 > primary.x + primary.width - rightPadding)
//                childBox.x2 = primary.x + primary.width - rightPadding;
//            childBox.y1 = this._appSwitcher.actor.allocation.y2 + spacing;
//            
////            this._thumbnails.addClones(primary.height - bottomPadding - childBox.y1);
//            this._appSwitcher.addClones(primary.height - bottomPadding - childBox.y1);
//            
//            let [childMinHeight, childNaturalHeight] = this._appSwitcher.actor.get_preferred_height(-1);
//            childBox.y2 = childBox.y1 + childNaturalHeight;
//            
////            this._thumbnails.actor.allocate(childBox, flags);
//            this._appSwitcher.actor.allocate(childBox, flags);
//        }
    },

    show : function(backward, switch_group) {
//        let tracker = Shell.WindowTracker.get_default();
//        let apps = tracker.get_running_apps ('');
//        let app = apps[1];
//        let windows = app.get_windows();
        
        let windows = this._appMenuButtonAlt.getWindows();

        if (/*!apps.length*/ !windows.length)
            return false;

        if (!Main.pushModal(this.actor))
            return false;
        this._haveModal = true;

        this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
        this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));

        this.actor.connect('button-press-event', Lang.bind(this, this._clickedOutside));
        this.actor.connect('scroll-event', Lang.bind(this, this._onScroll));

//        this._appSwitcher = new AppSwitcher(apps, this);
        this._appSwitcher = new AltTab.ThumbnailList(windows);
        
        this.actor.add_actor(this._appSwitcher.actor);
        this._appSwitcher.connect('item-activated', Lang.bind(this, this._appActivated));
        this._appSwitcher.connect('item-entered', Lang.bind(this, this._appEntered));

//        this._appIcons = this._appSwitcher.icons;
        this._appIcons = this._appSwitcher._thumbnailBins;

        // Make the initial selection
        if (switch_group) {
//            if (backward) {
//                this._select(0, this._appIcons[0].cachedWindows.length - 1);
//            } else {
//                if (this._appIcons[0].cachedWindows.length > 1)
//                    this._select(0, 1);
//                else
//                    this._select(0, 0);
//            }
            this._select(0);
        } else if (this._appIcons.length == 1) {
            this._select(0);
        } else if (backward) {
            this._select(this._appIcons.length - 1);
        } else {
            this._select(1);
        }

        // There's a race condition; if the user released Alt before
        // we got the grab, then we won't be notified. (See
        // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
        // details.) So we check now. (Have to do this after updating
        // selection.)
//        let [x, y, mods] = global.get_pointer();
//        if (!(mods & Gdk.ModifierType.MOD1_MASK)) {
//            this._finish();
//            return false;
//        }

        this.actor.opacity = 0;
        this.actor.show();
        Tweener.addTween(this.actor,
                         { opacity: 255,
                           time: AltTab.POPUP_FADE_TIME,
                           transition: 'easeOutQuad'
                         });

        return true;
    },

    _nextApp : function() {
        return AltTab.mod(this._currentApp + 1, this._appIcons.length);
    },
    _previousApp : function() {
        return AltTab.mod(this._currentApp - 1, this._appIcons.length);
    },

    _nextWindow : function() {
        return null;
        // We actually want the second window if we're in the unset state
        if (this._currentWindow == -1)
            this._currentWindow = 0;
        return AltTab.mod(this._currentWindow + 1,
                   this._appIcons[this._currentApp].cachedWindows.length);
    },
    _previousWindow : function() {
        return null;
        // Also assume second window here
        if (this._currentWindow == -1)
            this._currentWindow = 1;
        return AltTab.mod(this._currentWindow - 1,
                   this._appIcons[this._currentApp].cachedWindows.length);
    },

    _keyPressEvent : function(actor, event) {
        let keysym = event.get_key_symbol();
        let event_state = Shell.get_event_state(event);
        let backwards = event_state & Clutter.ModifierType.SHIFT_MASK;

//global.log('__________________________');
//global.log(event_state);
        event_state = event_state | Clutter.ModifierType.MOD1_MASK;
        
        let action = global.screen.get_display().get_keybinding_action(event.get_key_code(), event_state);
//global.log(keysym);
//global.log(event.get_key_code());
//global.log(event_state);
//global.log(action);
//global.log('_________________________________');
        
//        action = Meta.KeyBindingAction.SWITCH_WINDOWS;
        
        this._disableHover();

        if (action == Meta.KeyBindingAction.SWITCH_GROUP)
            this._select(this._currentApp, backwards ? this._previousWindow() : this._nextWindow());
        else if (keysym == Clutter.Escape)
            this.destroy();
        else if (this._thumbnailsFocused || 1 == 1) {
            if (action == Meta.KeyBindingAction.SWITCH_WINDOWS) {

                if (backwards) {
                    if (this._currentWindow == 0 || this._currentWindow == -1)
                        this._select(this._previousApp());
                    else
                        this._select(this._currentApp, this._previousWindow());
                } else {
                    if (this._currentWindow == this._appIcons[this._currentApp].cachedWindows.length - 1)
                        this._select(this._nextApp());
                    else
                        this._select(this._currentApp, this._nextWindow());
                }
            } else if (keysym == Clutter.Left) {
//                this._select(this._currentApp, this._previousWindow());
              this._select(this._previousApp());
            } else if (keysym == Clutter.Right) {
//                this._select(this._currentApp, this._nextWindow());
                this._select(this._nextApp());
            } else if (keysym == Clutter.Up) {
//                this._select(this._currentApp, null, true);
            } else if (keysym == Clutter.Return) {
                this._appActivated(this, this._currentApp);
            }
            
            
        } else {
            if (action == Meta.KeyBindingAction.SWITCH_WINDOWS)
                this._select(backwards ? this._previousApp() : this._nextApp());
            else if (keysym == Clutter.Left)
                this._select(this._previousApp());
            else if (keysym == Clutter.Right)
                this._select(this._nextApp());
            else if (keysym == Clutter.Down)
                this._select(this._currentApp, 0);
        }

        return true;
    },

    _keyReleaseEvent : function(actor, event) {
        let [x, y, mods] = global.get_pointer();
        let state = mods & Clutter.ModifierType.MOD1_MASK;

        if (state == 0)
//            this._finish();

        return true;
    },

    _onScroll : function(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.UP) {
            if (this._thumbnailsFocused) {
                if (this._currentWindow == 0 || this._currentWindow == -1)
                    this._select(this._previousApp());
                else
                    this._select(this._currentApp, this._previousWindow());
            } else {
                let nwindows = this._appIcons[this._currentApp].cachedWindows.length;
                if (nwindows > 1)
                    this._select(this._currentApp, nwindows - 1);
                else
                    this._select(this._previousApp());
            }
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            if (this._thumbnailsFocused) {
                if (this._currentWindow == this._appIcons[this._currentApp].cachedWindows.length - 1)
                    this._select(this._nextApp());
                else
                    this._select(this._currentApp, this._nextWindow());
            } else {
                let nwindows = this._appIcons[this._currentApp].cachedWindows.length;
                if (nwindows > 1)
                    this._select(this._currentApp, 0);
                else
                    this._select(this._nextApp());
            }
        }
    },

    _clickedOutside : function(actor, event) {
        this.destroy();
    },

    _appActivated : function(appSwitcher, n) {
        // If the user clicks on the selected app, activate the
        // selected window; otherwise (eg, they click on an app while
        // !mouseActive) activate the the clicked-on app.
//        if (n == this._currentApp) {
//            let window;
//            if (this._currentWindow >= 0)
//                window = this._appIcons[this._currentApp].cachedWindows[this._currentWindow];
//            else
//                window = null;
//            this._appIcons[this._currentApp].app.activate_window(window, global.get_current_time());
//        } else {
//            this._appIcons[n].app.activate_window(null, global.get_current_time());
//        }
//        this._appIcons[n].app.activate_window(null, global.get_current_time());
        
        try {
            let windows = this._appMenuButtonAlt.getWindows();
            this._appMenuButtonAlt.getApplication().activate_window(windows[n], global.get_current_time());
        } catch (e) {
            global.logError(e);
        }
        
        this.destroy();
    },

    _appEntered : function(appSwitcher, n) {
        if (!this._mouseActive)
            return;

        this._select(n);
    },

    _windowActivated : function(thumbnailList, n) {
        let appIcon = this._appIcons[this._currentApp];
        Main.activateWindow(appIcon.cachedWindows[n]);
        this.destroy();
    },

    _windowEntered : function(thumbnailList, n) {
        if (!this._mouseActive)
            return;

        this._select(this._currentApp, n);
    },

    _disableHover : function() {
        this._mouseActive = false;

        if (this._motionTimeoutId != 0)
            Mainloop.source_remove(this._motionTimeoutId);

        this._motionTimeoutId = Mainloop.timeout_add(AltTab.DISABLE_HOVER_TIMEOUT, Lang.bind(this, this._mouseTimedOut));
    },

    _mouseTimedOut : function() {
        this._motionTimeoutId = 0;
        this._mouseActive = true;
    },

    _finish: function() {
        let app = this._appIcons[this._currentApp];
        if (this._currentWindow >= 0) {
            Main.activateWindow(app.cachedWindows[this._currentWindow]);
        } else {
//            app.app.activate_window(null, global.get_current_time());
        }
        this.destroy();
    },

    _popModal: function() {
        if (this._haveModal) {
            Main.popModal(this.actor);
            this._haveModal = false;
        }
    },

    destroy : function() {
        this._popModal();
        if (this.actor.visible) {
            Tweener.addTween(this.actor,
                             { opacity: 0,
                               time: AltTab.POPUP_FADE_TIME,
                               transition: 'easeOutQuad',
                               onComplete: Lang.bind(this,
                                   function() {
                                       this.actor.destroy();
                                   })
                             });
        } else
            this.actor.destroy();
        this.emit('destroy');
    },

    _onDestroy : function() {
        this._popModal();

        if (this._thumbnails)
            this._destroyThumbnails();

        if (this._motionTimeoutId != 0)
            Mainloop.source_remove(this._motionTimeoutId);
        if (this._thumbnailTimeoutId != 0)
            Mainloop.source_remove(this._thumbnailTimeoutId);
    },

    /**
     * _select:
     * @app: index of the app to select
     * @window: (optional) index of which of @app's windows to select
     * @forceAppFocus: optional flag, see below
     *
     * Selects the indicated @app, and optional @window, and sets
     * this._thumbnailsFocused appropriately to indicate whether the
     * arrow keys should act on the app list or the thumbnail list.
     *
     * If @app is specified and @window is unspecified or %null, then
     * the app is highlighted (ie, given a light background), and the
     * current thumbnail list, if any, is destroyed. If @app has
     * multiple windows, and @forceAppFocus is not %true, then a
     * timeout is started to open a thumbnail list.
     *
     * If @app and @window are specified (and @forceAppFocus is not),
     * then @app will be outlined, a thumbnail list will be created
     * and focused (if it hasn't been already), and the @window'th
     * window in it will be highlighted.
     *
     * If @app and @window are specified and @forceAppFocus is %true,
     * then @app will be highlighted, and @window outlined, and the
     * app list will have the keyboard focus.
     */
    _select : function(app, window, forceAppFocus) {
        if (app != this._currentApp || window == null) {
            if (this._thumbnails)
                this._destroyThumbnails();
        }

        if (this._thumbnailTimeoutId != 0) {
            Mainloop.source_remove(this._thumbnailTimeoutId);
            this._thumbnailTimeoutId = 0;
        }

        this._thumbnailsFocused = (window != null) && !forceAppFocus;

        this._currentApp = app;
        this._currentWindow = window ? window : -1;
        this._appSwitcher.highlight(app, this._thumbnailsFocused);

        if (window != null) {
            if (!this._thumbnails)
                this._createThumbnails();
            this._currentWindow = window;
            this._thumbnails.highlight(window, forceAppFocus);
        } /*else if (this._appIcons[this._currentApp].cachedWindows.length > 1 &&
                   !forceAppFocus) {
            this._thumbnailTimeoutId = Mainloop.timeout_add (
                AltTab.THUMBNAIL_POPUP_TIME,
                Lang.bind(this, this._timeoutPopupThumbnails));
        }*/
    },

    _timeoutPopupThumbnails: function() {
        if (!this._thumbnails)
            this._createThumbnails();
        this._thumbnailTimeoutId = 0;
        this._thumbnailsFocused = false;
        return false;
    },

    _destroyThumbnails : function() {
        let thumbnailsActor = this._thumbnails.actor;
        Tweener.addTween(thumbnailsActor,
                         { opacity: 0,
                           time: AltTab.THUMBNAIL_FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function() {
                                                            thumbnailsActor.destroy();
                                                            this.thumbnailsVisible = false;
                                                        })
                         });
        this._thumbnails = null;
    },

    _createThumbnails : function() {
        this._thumbnails = new ThumbnailList (this._appIcons[this._currentApp].cachedWindows);
        this._thumbnails.connect('item-activated', Lang.bind(this, this._windowActivated));
        this._thumbnails.connect('item-entered', Lang.bind(this, this._windowEntered));

        this.actor.add_actor(this._thumbnails.actor);

        this._thumbnails.actor.opacity = 0;
        Tweener.addTween(this._thumbnails.actor,
                         { opacity: 255,
                           time: AltTab.THUMBNAIL_FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function () { this.thumbnailsVisible = true; })
                         });
    }
};

Signals.addSignalMethods(ThumbnailsPopup.prototype);

function WindowsList(listContainer) {
	this._init(listContainer);
}

WindowsList.prototype = {
	_init: function(listContainer) {
		
		this.listContainer = listContainer;
		this.tracker = Shell.WindowTracker.get_default();
		this.apps = {};
		this._thumbnails = null;
		this.thumbnailsVisible = false;

		
        this._nWorkspacesNotifyId =
            global.screen.connect('notify::n-workspaces',
                                  Lang.bind(this, this._workspacesChanged));

        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));
        
        this._activeWorkspaceChanged();
        
	},
	
	/**
	 * Number of workspaces changed
	 */
	_workspacesChanged: function() {
		
//		global.log('_workspaceChanged');
	},
	
	/**
	 * Active workspace changed
	 */
	_activeWorkspaceChanged: function() {

//		global.log('___WORKSPACE_CHANGED___');
		
		if (this._windowAddedId)
			this.metaWorkspace.disconnect(this._windowAddedId);
		if (this._windowRemovedId)
			this.metaWorkspace.disconnect(this._windowRemovedId);

		this.metaWorkspace = global.screen.get_active_workspace();
		
        this._windowAddedId = this.metaWorkspace.connect('window-added',
                                                         Lang.bind(this, this._windowAdded));
        this._windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                           Lang.bind(this, this._windowRemoved));
		
        this._sync();
	},
	
	_windowAdded: function(metaWorkspace, metaWin) {
		
//		global.log('___WINDOW_ADDED___');
		
		try {
			
			let app = this.tracker.get_window_app(metaWin);			
			let appName = app.get_name();
			
			if (!this.apps[appName] && this.metaWorkspace == metaWorkspace)
				this.apps[appName] = this._createAppMenuButton(app);
			
		} catch(e) {
			global.log(e);
		}
	},
	
	_windowRemoved: function(metaWorkspace, metaWin) {
		
//		global.log('___WINDOW_REMOVED___');
		
		try {
			
			// NOTE: Can't get the application object from metaWin, app = null ?
//			let app = this.tracker.get_window_app(metaWin);
//			let appName = app.get_name();
//			
//			if (this.apps[appName] && this.metaWorkspace == metaWorkspace) {
//				let windows = app.get_windows();
//				global.log(windows.length);
////				delete this.apps[appName];
//			}
			
			this._sync();
			
		} catch(e) {
			global.log(e);
		}
	},
	
	_sync: function() {
		
		this._clearWindowsList();
		
		let apps = this.tracker.get_running_apps('');
		apps.forEach(Lang.bind(this, function(app) {
			let appName = app.get_name();
			if (!this.apps[appName] && app.is_on_workspace(this.metaWorkspace)) {
				this.apps[appName] = this._createAppMenuButton(app);
			}
		}));
		
		window._apps = this.apps;
	},
	
	_clearWindowsList: function() {
		let children = this.listContainer.get_children();
		for (let i=0, l=children.length; i<l; i++) {
			this.listContainer.remove_actor(children[i]);
		}
		for (let o in this.apps) {
			let appIcon = this.apps[o];
			Main.panel._menus.removeMenu(appIcon.menu);
		};
		this.apps = {};
	},
	
	_createAppMenuButton: function(app) {

//		global.log(app.get_name());
		
		let appMenuButtonAlt = null;
		
		try {
			
			appMenuButtonAlt = new AppMenuButtonAlt(app);
			
//			let thumbnails = new AltTab.ThumbnailList(appMenuButtonAlt.getWindows());
//			appMenuButtonAlt._quitMenu.actor.add_actor(thumbnails.actor);
			
			this.listContainer.add(appMenuButtonAlt.actor, { y_fill: true });
			appMenuButtonAlt.menu._boxPointer._arrowSide = St.Side.BOTTOM;
		    Main.panel._menus.addMenu(appMenuButtonAlt.menu);
		    
		    // Synchronize the button's pseudo classes with its corner
		    appMenuButtonAlt.actor.connect('style-changed', Lang.bind(this,
	    		function(actor) {
			    	let rtl = actor.get_direction() == St.TextDirection.RTL;
			    	let corner = rtl ? Main.panel._rightCorner : Main.panel._leftCorner;
			    	let pseudoClass = actor.get_style_pseudo_class();
			    	corner.actor.set_style_pseudo_class(pseudoClass);
			    }));
		    
		    appMenuButtonAlt.actor.connect(/*'notify::hover'*/ 'button-press-event', Lang.bind(this, function(actor) {
		        try {
		            this.show(appMenuButtonAlt);
    	        } catch(e) {
    	            global.logError(e);
    	        }
		    }));
            
            appMenuButtonAlt.actor.connect('notify::hover', Lang.bind(this, function(actor) {
                if (this.thumbnailsVisible) {
//                    global.log('__HOVER__');
                }
            }));
		    
		} catch(e) {
			global.logError(e);
			return null;
		}

	    return appMenuButtonAlt;
	},
	
	show: function(appMenuButtonAlt) {
	    
//	    if (this._thumbnails && appMenuButtonAlt === this._thumbnails._appMenuButtonAlt) {
//	        global.log('__1__');
//	        return;
//	    }
	    
//	    global.log(this.thumbnailsVisible);
	    if (this.thumbnailsVisible) {
	        global.log(appMenuButtonAlt === this._thumbnails._appMenuButtonAlt);
            global.log(appMenuButtonAlt);
            global.log(this._thumbnails._appMenuButtonAlt);
	        if (appMenuButtonAlt === this._thumbnails._appMenuButtonAlt)
	            this.hide();
	    }

	    this._thumbnails = new ThumbnailsPopup(appMenuButtonAlt);

	    // See Meta.KeyBindingAction, Meta.KeyBindingAction.SWITCH_GROUP
        if (!this._thumbnails.show(backwards = false, binding = Meta.KeyBindingAction.SWITCH_WINDOWS)) {
            
            this._thumbnails.destroy();
//            this._thumbnails = undefined;
            
        } else {
            
            this.thumbnailsVisible = true;
            this._thumbnails.connect('destroy', Lang.bind(this, function(actor) {
//                global.log('__DESTROY__');
//                this.hide();
                this._thumbnails = undefined;
                this.thumbnailsVisible = false;
            }));
        }
        
//        Mainloop.timeout_add(4000, Lang.bind(this, this.hide));
	},
	
	hide: function() {
	    if (this._thumbnails)
	        this._thumbnails.destroy();
	}
}

function removeStandardAppMenuButton() {
    let children = Main.panel._leftBox.get_children();
    // Skip applications menu
    for (let i=1, l=children.length; i<l; i++) {
        try {
            let menuButton = children[i];
    //        Main.panel._menus.removeMenu(menuButton.menu);
            Main.panel._leftBox.remove_actor(menuButton);
        } catch(e) {
            global.logError(e);
            global.logError(menuButton);
        }
    }
}

function main(extensionMeta) {

    removeStandardAppMenuButton();
    let wl = new WindowsList(Main.panel._centerBox);
}
