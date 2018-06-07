const proxy = (a, b) => (e) => b(a(e));

const bind = (el, event, callback) =>
    el.addEventListener && el.addEventListener(event, callback);

const unbind = (el, event, callback) =>
    el.removeEventListener && el.removeEventListener(event, callback);

const noop = () => { /* empty */ };

const touchRegExp = /touch/;

// 300ms is the usual mouse interval;
// // However, an underpowered mobile device under a heavy load may queue mouse events for a longer period.
const IGNORE_MOUSE_TIMEOUT = 2000;

function normalizeEvent(e) {
    if (e.type.match(touchRegExp)) {
        return {
            pageX: e.changedTouches[0].pageX,
            pageY: e.changedTouches[0].pageY,
            type: e.type,
            originalEvent: e
        };
    }

    return {
        pageX: e.pageX,
        pageY: e.pageY,
        offsetX: e.offsetX,
        offsetY: e.offsetY,
        type: e.type,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        originalEvent: e
    };
}

export class Draggable {
    static supportPointerEvent() {
        return window.PointerEvent;
    }

    constructor({ press = noop, drag = noop, release = noop, mouseOnly = false }) {
        this._pressHandler = proxy(normalizeEvent, press);
        this._dragHandler = proxy(normalizeEvent, drag);
        this._releaseHandler = proxy(normalizeEvent, release);
        this._ignoreMouse = false;
        this._mouseOnly = mouseOnly;
        this._touchAction;

        this._touchstart = (e) => {
            if (e.touches.length === 1) {
                this._pressHandler(e);
            }
        };

        this._touchmove = (e) => {
            if (e.touches.length === 1) {
                this._dragHandler(e);
            }
        };

        this._touchend = (e) => {
            // the last finger has been lifted, and the user is not doing gesture.
            // there might be a better way to handle this.
            if (e.touches.length === 0 && e.changedTouches.length === 1) {
                this._releaseHandler(e);
                this._ignoreMouse = true;
                setTimeout(this._restoreMouse, IGNORE_MOUSE_TIMEOUT);
            }
        };

        this._restoreMouse = () => {
            this._ignoreMouse = false;
        };

        this._mousedown = (e) => {
            const { which } = e;

            if ((which && which > 1) || this._ignoreMouse) {
                return;
            }

            bind(document, "mousemove", this._mousemove);
            bind(document, "mouseup", this._mouseup);
            this._pressHandler(e);
        };

        this._mousemove = (e) => {
            this._dragHandler(e);
        };

        this._mouseup = (e) => {
            unbind(document, "mousemove", this._mousemove);
            unbind(document, "mouseup", this._mouseup);
            this._releaseHandler(e);
        };

        this._pointerdown = (e) => {
            if (e.isPrimary && e.button === 0) {
                bind(this._element, "pointermove", this._pointermove);
                this._touchAction = e.target.style.touchAction;
                e.target.style.touchAction = "none";
                e.target.setPointerCapture(e.pointerId);
                this._pressHandler(e);
            }
        };

        this._pointermove = (e) => {
            if (e.isPrimary) {
                this._dragHandler(e);
            }
        };

        this._pointerup = (e) => {
            if (e.isPrimary) {
                unbind(this._element, "pointermove", this._pointermove);
                e.target.style.touchAction = this._touchAction;
                e.target.releasePointerCapture(e.pointerId);
                this._releaseHandler(e);
            }
        };
    }

    bindTo(element) {
        if (element === this._element) {
            return;
        }

        if (this._element) {
            this._unbindFromCurrent();
        }

        this._element = element;
        this._bindToCurrent();
    }

    _bindToCurrent() {
        const element = this._element;

        if (this._usePointers()) {
            bind(element, "pointerdown", this._pointerdown);
            bind(element, "pointerup", this._pointerup);
            return;
        }

        bind(element, "mousedown", this._mousedown);

        if (!this._mouseOnly) {
            bind(element, "touchstart", this._touchstart);
            bind(element, "touchmove", this._touchmove);
            bind(element, "touchend", this._touchend);
        }
    }

    _unbindFromCurrent() {
        const element = this._element;

        if (this._usePointers()) {
            unbind(element, "pointerdown", this._pointerdown);
            unbind(element, "pointermove", this._pointermove);
            unbind(element, "pointerup", this._pointerup);
            return;
        }

        unbind(element, "mousedown", this._mousedown);

        if (!this._mouseOnly) {
            unbind(element, "touchstart", this._touchstart);
            unbind(element, "touchmove", this._touchmove);
            unbind(element, "touchend", this._touchend);
        }
    }

    _usePointers() {
        return !this._mouseOnly && Draggable.supportPointerEvent();
    }

    destroy() {
        this._unbindFromCurrent();
        this._element = null;
    }
}

// Re-export as "default" field to address a bug
// where the ES Module is imported by CommonJS code.
//
// See https://github.com/telerik/kendo-angular/issues/1314
Draggable.default = Draggable;

// Rollup won't output exports['default'] otherwise
export default Draggable;

