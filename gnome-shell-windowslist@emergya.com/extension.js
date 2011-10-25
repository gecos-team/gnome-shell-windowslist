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
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Pango = imports.gi.Pango;
const Gettext = imports.gettext;
const _ = Gettext.domain('gnome-shell').gettext;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Overview = imports.ui.overview;
const Tweener = imports.ui.tweener;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const AltTab = imports.ui.altTab;

const WINDOW_TITLE_MAX_LENGTH = 40;
const APP_BUTTON_MAX_LENGTH = 150;
const APP_BUTTON_MIN_LENGTH = 10;

let _f = null;

function TextShadower() {
    this._init();
}

TextShadower.prototype = {
    __proto__: Panel.TextShadower.prototype,

    _init: function() {
        this.actor = new Shell.GenericContainer();
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        this._label = new St.Label();
        this.actor.add_actor(this._label);
        this._label.raise_top();
    },

    setText: function(text) {
        this._label.set_text(text);
    },

    _allocate: function(actor, box, flags) {

        let [availWidth, availHeight] = actor.get_parent().get_size();

        let [minChildWidth, minChildHeight, natChildWidth, natChildHeight] =
            this._label.get_preferred_size();

        let childWidth = Math.min(natChildWidth, availWidth - 4);
        let childHeight = Math.min(natChildHeight, availHeight - 2);

        let childBox = new Clutter.ActorBox();
        childBox.x1 = 1;
        childBox.y1 = 1;
        childBox.x2 = childBox.x1 + childWidth;
        childBox.y2 = childBox.y1 + childHeight;

        this._label.allocate(childBox, flags);
    }
};

function AppMenuButtonAlt(app) {
    this._init(app);
}

AppMenuButtonAlt.prototype = {
    __proto__: Panel.AppMenuButton.prototype,

    _init: function(app) {
        Panel.AppMenuButton.prototype._init.call(this, 0.0);
        this._targetApp = app;
        this._container.remove_actor(this._label.actor);
        this._label = new TextShadower();
        this._container.add_actor(this._label.actor);
        this._refreshMenuItems();
        this._sync();
    },

    /**
     * Overwrite this method just for adjust the separation between
     * the icon and the label the way we want.
     */
    _contentAllocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = 0;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this._iconBox.allocate(childBox, flags);

        let iconWidth = childBox.x2 - childBox.x1;

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.actor.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth + iconWidth / 2);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            childBox.x2 = allocWidth - Math.floor(iconWidth / 2);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.actor.allocate(childBox, flags);

        if (direction == St.TextDirection.LTR) {
            // This is the line we are interested on
            childBox.x1 = Math.floor(iconWidth / 2) + this._label.actor.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        } else {
            childBox.x1 = -this._spinner.actor.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        }
    },

    setMenuSide: function() {
        // The box pointer direction depends on the main panel position.
        // Because the extensions load order could vary,
        // we better do this check every time the menu is refreshed.
        let [x, y] = Main.layoutManager.panelBox.get_position();
        let side = y == 0 ? St.Side.TOP : St.Side.BOTTOM;
        this.menu._boxPointer._arrowSide = side;
    },

    _refreshMenuItems: function() {

        // Be sure to upate the box pointer direction
        this.setMenuSide();
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

        let item = new PopupMenu.PopupMenuItem(_f('Close all'));
        item.connect('activate', Lang.bind(this, this._onQuit));
        this.menu.addMenuItem(item);
    },

    _itemActivated: function(window) {
        if (!window.has_focus()) {
            Main.activateWindow(window);
        } else {
            window.minimize();
        }
    },

    /**
     * Return the windows of an application in the current workspace.
     */
    getWindows: function() {
        var windows = [];
        var _windows = this._targetApp.get_windows();
        var active_workspace = global.screen.get_active_workspace();

        for (var i=0, l=_windows.length; i<l; i++) {
            var window = _windows[i];
            var window_workspace = window.get_workspace();
            if (window_workspace == active_workspace) {
                windows.push(window);
            }
        }

        return windows;
    },

    _onQuit: function() {
        // Close all windows
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
        if (this.menu.isOpen) {
            this.menu.close();
            return;
        }
        let windows = this.getWindows();
        let button = event.get_button();
        if (button == 1 && windows.length == 1) {
            this._itemActivated(windows[0]);
        } else {
            PanelMenu.Button.prototype._onButtonPress.call(this, actor, event);
        }
    },

    _sync: function() {

        if (!this._targetApp)
            return;
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
        let icon = targetApp.get_faded_icon(Panel.PANEL_ICON_SIZE);

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
        this.appSystem = Shell.AppSystem.get_default();
        this.apps = {};
        this.metaWorkspace = null;
        this._windowAddedId = null;
        this._windowRemovedId = null;

        this._nWorkspacesNotifyId =
            global.screen.connect('notify::n-workspaces',
                                  Lang.bind(this, this._workspacesChanged));

        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));

        Main.panel.actor.connect('allocate', Lang.bind(this, function(container, box, flags) {
            this._allocatePanel(container, box, flags, Main.panel);
        }));

        this._activeWorkspaceChanged();
    },

    /**
     * Number of workspaces changed
     */
    _workspacesChanged: function() {
      this._activeWorkspaceChanged();
    },

    /**
     * Active workspace changed
     */
    _activeWorkspaceChanged: function() {

        if (this._windowAddedId) {
            this.metaWorkspace.disconnect(this._windowAddedId);
            this._windowAddedId = null;
        }

        if (this._windowRemovedId) {
            this.metaWorkspace.disconnect(this._windowRemovedId);
            this._windowRemovedId = null;
        }

        this.metaWorkspace = global.screen.get_active_workspace();

        this._windowAddedId = this.metaWorkspace.connect('window-added',
                                                         Lang.bind(this, this._windowAdded));
        this._windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                           Lang.bind(this, this._windowRemoved));

        this._sync();
    },

    _windowAdded: function(metaWorkspace, metaWin) {

        let app = this.tracker.get_window_app(metaWin);
        if (!app)
            return;
        let appName = app.get_name();

        if (!this.apps[appName] && this.metaWorkspace == metaWorkspace)
            this.apps[appName] = this._createAppMenuButton(app);
    },

    _windowRemoved: function(metaWorkspace, metaWin) {
        this._sync();
    },

    _sync: function() {

        this._clearWindowsList();

        let apps = this.appSystem.get_running();
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

        let appMenuButtonAlt = new AppMenuButtonAlt(app);

        this.listContainer.add(appMenuButtonAlt.actor, { y_fill: true });
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
    },

    _allocatePanel: function(container, box, flags, panel) {

        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let [leftMinWidth, leftNaturalWidth] = panel._leftBox.get_preferred_width(-1);
        let [centerMinWidth, centerNaturalWidth] = panel._centerBox.get_preferred_width(-1);
        let [rightMinWidth, rightNaturalWidth] = panel._rightBox.get_preferred_width(-1);

        let childBox = new Clutter.ActorBox();
        let centerLeft = 0;
        let centerRight = 0;

        // Left box
        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (panel.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = allocWidth - leftNaturalWidth;
            childBox.x2 = allocWidth;
        } else {
            childBox.x1 = 0;
            childBox.x2 = leftNaturalWidth;
            centerLeft = childBox.x2;
        }
        panel._leftBox.allocate(childBox, flags);

        // Right box
        childBox.y1 = 0;
        childBox.y2 = allocHeight;
        if (panel.actor.get_direction() == St.TextDirection.RTL) {
            childBox.x1 = 0;
            childBox.x2 = rightNaturalWidth;
        } else {
            childBox.x1 = allocWidth - rightNaturalWidth;
            childBox.x2 = allocWidth;
            centerRight = childBox.x1;
        }
        panel._rightBox.allocate(childBox, flags);

        // Center box
        childBox.x1 = centerLeft;
        childBox.y1 = 0;
        childBox.x2 = centerRight;
        childBox.y2 = allocHeight;
        panel._centerBox.allocate(childBox, flags);

        // Application buttons width
        let children = panel._centerBox.get_children();
        let width = childBox.x2 - childBox.x1;
        let n_apps = isNaN(children.length) ? -1 : children.length;
        n_apps = n_apps <= 0 ? false : n_apps;

        if (!n_apps)
            return;

        let appWidth = Math.floor(width / n_apps);
        appWidth = Math.min(appWidth, APP_BUTTON_MAX_LENGTH);
        appWidth = Math.max(appWidth, APP_BUTTON_MIN_LENGTH);

        for (let i = 0; i < n_apps; i++) {
            let appButton = children[i];
            appButton.set_width(appWidth);
        }
    }
}

function removeStandardAppMenuButton() {
    let children = Main.panel._leftBox.get_children();
    for (let i=0, l=children.length; i<l; i++) {
        let _child = children[i].get_children();
        _child = _child[0];
        if (_child.get_name() == 'appMenu') {
    //        Main.panel._menus.removeMenu(children[i].menu);
            Main.panel._leftBox.remove_actor(children[i]);
            break;
        }
    }
}

function main(meta) {

    let localePath = meta.path + '/locale';
    Gettext.bindtextdomain('gnome-shell-windowslist', localePath);
    _f = Gettext.domain('gnome-shell-windowslist').gettext;

    removeStandardAppMenuButton();
    let wl = new WindowsList(Main.panel._centerBox);
}

function init(meta) {
    main(meta);
}

function enable() {
}

function disable() {
}
