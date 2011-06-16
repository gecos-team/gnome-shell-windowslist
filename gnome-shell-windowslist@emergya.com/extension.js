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

const WINDOW_TITLE_MAX_LENGTH = 40;

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
        

//        global.window_manager.connect('switch-workspace', Lang.bind(this, this._sync));

        this._refreshMenuItems();
        this._sync();
    },
    
    _refreshMenuItems: function() {
        
        this.menu.removeAll();
        let windows = this.getWindows();
        
        for (let i = 0, l = windows.length; i < l; i++) {
            let window = windows[i];
            let title = window.get_title();
            if (title.length > WINDOW_TITLE_MAX_LENGTH) {
                title = title.substr(0, WINDOW_TITLE_MAX_LENGTH - 3) + '...';
            }
            let item = new PopupMenu.PopupMenuItem(title);
            item.connect('activate', Lang.bind(this, function() { this._itemActivated(window); }));
            this.menu.addMenuItem(item);
        }
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let item = new PopupMenu.PopupMenuItem(_('Cerrar todo'));
        item.connect('activate', Lang.bind(this, this._onQuit));
        this.menu.addMenuItem(item);
    },
    
    _itemActivated: function(window) {
        Main.activateWindow(window);
    },
    
    getWindows: function() {
        let windows = this._targetApp.get_windows();
        return windows;
    },
    
    _onQuit: function() {
        let windows = this.getWindows();
        for (let i = 0, l = windows.length; i < l; i++) {
            let window = windows[i];
            window.delete(global.get_current_time());
        }
    },

    _onOpenStateChanged: function(menu, open) {
        if (open) {
            this._refreshMenuItems();
        }
        PanelMenu.Button.prototype._onOpenStateChanged.call(this, menu, open);
    },

    _onButtonPress: function(actor, event) {
        let windows = this.getWindows();
        if (windows.length == 1 && !this.menu.isOpen) {
            this._itemActivated(windows[0]);
        }
        PanelMenu.Button.prototype._onButtonPress.call(this, actor, event);
    },

    _sync: function() {
        
        let targetApp = this._targetApp;

        if (!this._targetIsCurrent) {
            this.actor.reactive = true;
            this._targetIsCurrent = true;

            Tweener.removeTweens(this.actor);
            Tweener.addTween(this.actor, { opacity: 255,
                                           time: Overview.ANIMATION_TIME,
                                           transition: 'easeOutQuad' });
        }

        this._spinner.actor.hide();
        if (this._iconBox.child != null)
            this._iconBox.child.destroy();
        this._iconBox.hide();
        this._label.setText('');

        this._targetApp = targetApp;
        let icon = targetApp.get_faded_icon(2 * Panel.PANEL_ICON_SIZE);

        this._label.setText(targetApp.get_name());

        this._iconBox.set_child(icon);
        this._iconBox.show();

        if (targetApp.get_state() == Shell.AppState.STARTING)
            this.startAnimation();
        
        this.emit('changed');
    }
};

Signals.addSignalMethods(AppMenuButtonAlt.prototype);

function WindowsList(listContainer) {
    this._init(listContainer);
}

WindowsList.prototype = {
    _init: function(listContainer) {
        
        this.listContainer = listContainer;
        this.tracker = Shell.WindowTracker.get_default();
        this.apps = {};
        
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
        
//      global.log('_workspaceChanged');
    },
    
    /**
     * Active workspace changed
     */
    _activeWorkspaceChanged: function() {

//      global.log('___WORKSPACE_CHANGED___');
        
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
        
//      global.log('___WINDOW_ADDED___');
        
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
        
//      global.log('___WINDOW_REMOVED___');
        this._sync();
    },
    
    _sync: function() {
        
        this._clearWindowsList();
        
        let apps = this.tracker.get_running_apps('');
        for (let i = 0, l = apps.length; i < l; i++) {
            let app = apps[i];
            let appName = app.get_name();
            if (!this.apps[appName] && app.is_on_workspace(this.metaWorkspace)) {
                this.apps[appName] = this._createAppMenuButton(app);
            }
        }
        
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

//      global.log(app.get_id());
//      global.log(app.get_name());
                    
        let appMenuButtonAlt = new AppMenuButtonAlt(app);
        
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

        return appMenuButtonAlt;
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

    Main.panel._boxContainer.connect('allocate', Lang.bind(Main.panel, function allocatePanel(container, box, flags) {

        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let [leftMinWidth, leftNaturalWidth] = this._leftBox.get_preferred_width(-1);
        let [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_width(-1);
        let [rightMinWidth, rightNaturalWidth] = this._rightBox.get_preferred_width(-1);

        let childBox = new Clutter.ActorBox();
        let centerLeft = 0;
        let centerRight = 0;

        // Left box
        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = allocWidth - Math.min(Math.floor(sideWidth),
                                                leftNaturalWidth);
            childBox.x2 = allocWidth;
        } else {
            childBox.x1 = 0;
            childBox.x2 = leftNaturalWidth;
            centerLeft = childBox.x2;
        }
        this._leftBox.allocate(childBox, flags);

        // Right box
        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = 0;
            childBox.x2 = Math.min(Math.floor(sideWidth),
                                   rightNaturalWidth);
        } else {
            childBox.x1 = allocWidth - rightNaturalWidth;
            childBox.x2 = allocWidth;
            centerRight = childBox.x1;
        }
        this._rightBox.allocate(childBox, flags);
        
        // Center box
        childBox.x1 = centerLeft;
        childBox.y1 = 0;
        childBox.x2 = centerRight;
        childBox.y2 = allocHeight;
        this._centerBox.allocate(childBox, flags);
    }));
    
    removeStandardAppMenuButton();
    let wl = new WindowsList(Main.panel._centerBox);
}
