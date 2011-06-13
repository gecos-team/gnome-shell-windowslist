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
const St = imports.gi.St;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
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
    
    getWindows: function() {
		let windows = this._targetApp.get_windows();
		return windows;
    },
    
    _onQuit: function() {
    	
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
			
			let thumbnails = new AltTab.ThumbnailList(appMenuButtonAlt.getWindows());
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
		    
		    appMenuButtonAlt.actor.connect('notify::hover', Lang.bind(this, function(actor) {
		        try {
		            this.show(appMenuButtonAlt);
    	        } catch(e) {
    	            global.logError(e);
    	        }
		    }));
		    
		} catch(e) {
			global.logError(e);
			return null;
		}

	    return appMenuButtonAlt;
	},
	
	show: function(appMenuButtonAlt) {
	    
	    if (this.thumbnailsVisible)
	        return;
		    
    	this._thumbnails = new AltTab.ThumbnailList(appMenuButtonAlt.getWindows());
    	
    	Main.uiGroup.add_actor(this._thumbnails.actor);
    	
    	let monitor = global.get_primary_monitor();
    	this._thumbnails.actor.set_height(208);
    	this._thumbnails.actor.set_position(
    			Math.floor(monitor.width / 2 - this._thumbnails.actor.width / 2),
    			Math.floor(monitor.height / 2 - this._thumbnails.actor.height / 2)
    	);
    	
//    	try {
//    	    this._thumbnails.addClones(404);
//    	} catch (e) {
//    	    global.logError(e);
//    	}

        this._thumbnails.actor.opacity = 0;
        Tweener.addTween(this._thumbnails.actor,
                         { opacity: 255,
                           time: AltTab.THUMBNAIL_FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function () { /*this.thumbnailsVisible = true;*/ })
                         });

//            this._thumbnails.highlight(window, forceAppFocus);
        
        this._thumbnails.addClones(AltTab.THUMBNAIL_DEFAULT_SIZE);
        
        this.thumbnailsVisible = true;
        Mainloop.timeout_add(4000, Lang.bind(this, this.hide));
	},
	
	hide: function() {
        if (this._thumbnails != null) {
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
//            global.stage.remove_actor(this._thumbnails.actor);
            Main.uiGroup.remove_actor(this._thumbnails.actor);
            this._thumbnails = null;
        }
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
