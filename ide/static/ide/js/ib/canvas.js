(function() {
    var STATUS_BAR_HEIGHT = 16;
    /**
     * Represents an IB canvas, which can contain layers.
     * @param {jQuery|HTMLElement} parent Node to which to attach the canvas.
     * @constructor
     */
    IB.Canvas = function(parent) {
        var self = this;
        var mChildren = [];
        var mNode = null;
        var mScaleX = null;
        var mScaleY = null;
        var mBackgroundColour = IB.ColourWhite;

        // Drag tracking.
        var mMouseDownCoords = null;
        var mMouseDownNode = null;
        var mMouseNodeOffset = null;
        var mLastCoords = null;

        // Selection management
        var mSelectedLayer = null;
        var mResizer = null;

        // Keyboard management
        var mPressedKeys = {};

        // Window properties
        var mProperties = {
            bg: new IB.Properties.Colour("Background", IB.ColourWhite),
            fullscreen: new IB.Properties.Bool("Fullscreen", CloudPebble.ProjectInfo.app_is_watchface)
        }
        mProperties.bg.on('change', handleBackgroundChange, this);
        mProperties.fullscreen.on('change', handleFullscreenChange, this);
        // Watchfaces must be fullscreen.
        if(CloudPebble.ProjectInfo.app_is_watchface) {
            mProperties.fullscreen.lock();
        }

        _.extend(this, Backbone.Events);

        function init(parent) {
            mNode = $('<div class="ib-canvas">');
            mNode.on('mousedown', handleMouseDown);
            mNode.appendTo(parent);

            mScaleX = parent.width() / 144;
            mScaleY = parent.height() / 168;

            var cssTransform = 'scale(' + mScaleX + ',' + mScaleY + ')';

            mNode.css({
                width: 144,
                height: 168,
                position: 'relative',
                '-webkit-transform-origin': '0 0',
                '-moz-transform-origin': '0 0',
                '-ms-transform-origin': '0 0',
                'transform-origin': '0 0',
                '-webkit-transform': cssTransform,
                '-moz-transform': cssTransform,
                '-ms-transform': cssTransform,
                transform: cssTransform,
                overflow: 'hidden',
                'background-color': mProperties.bg.getValue().css
            });

            handleFullscreenChange(mProperties.fullscreen.getValue());
        }

        /**
         * Given a mouse event from jQuery, returns a canvas-relative Pos indicating the mouse position.
         * @param {jQuery.Event} e jQuery event object
         * @returns {IB.Pos} Canvas position
         */
        function eventToPosition(e) {
            return pageCoordsToPosition(e.pageX, e.pageY);
        }

        function offsetToPosition(offset) {
            return pageCoordsToPosition(offset.left, offset.top);
        }

        function pageCoordsToPosition(x, y) {
            var me = mNode.offset();
            return new IB.Pos(Math.round((x - me.left) / mScaleX), Math.round((y - me.top) / mScaleY));
        }

        function handleMouseDown(e) {
            if(e.which != 1) return; // left mouse button
            mNode.one('mouseup', handleMouseUp);
            mNode.on('mousemove', handleDrag);
            $('body').one('mouseup', handlePageMouseUp);
            mMouseDownCoords = eventToPosition(e);
            mLastCoords = _.clone(mMouseDownCoords);
            mMouseDownNode = $(e.target);
            if(mMouseDownNode) {
                var nodePos = offsetToPosition(mMouseDownNode.offset());
                mMouseNodeOffset = {x: mMouseDownCoords.x - nodePos.x, y: mMouseDownCoords.y - nodePos.y};

                // We want to fiddle selections immediately on mousedown.
                if(mMouseDownNode[0] == mNode[0]) {
                    self.selectLayer(null);
                } else {
                    var object = mMouseDownNode.data('object');
                    if(object && object instanceof IB.Layer) {
                        self.selectLayer(object);
                    }
                }
            }
        }

        function handleMouseUp(e) {
            var mouseUpCoords = eventToPosition(e);
            if(mouseUpCoords.x == mMouseDownCoords.x && mouseUpCoords.y == mMouseDownCoords.y) {
                handleClick();
            }
        }

        function handlePageMouseUp(e) {
            mNode.off('mousemove', handleDrag);
            mMouseDownCoords = null;
            mMouseDownNode = null;
            mMouseNodeOffset = null;
            mLastCoords = null;
        }

        function handleDrag(e) {
            // If it's a layer, set its position.
            if(mMouseDownNode) {
                var mousePos = eventToPosition(e);
                var object = mMouseDownNode.data('object');
                if(!object) return;
                if(object instanceof IB.Layer) {
                    object.setPos(mousePos.x - mMouseNodeOffset.x, mousePos.y - mMouseNodeOffset.y);
                    object.render();
                } else if(object instanceof IB.Resizer) {
                    var layer = object.getLayer();
                    var size = layer.getSize();
                    var pos = layer.getPos();
                    var resizeX = mMouseDownNode.data('resize-x');
                    var resizeY = mMouseDownNode.data('resize-y');

                    if(resizeX == 1) {
                        size.w = Math.max(size.w + (mousePos.x - mLastCoords.x), 0);
                    } else if(resizeX == -1) {
                        size.w = Math.max(size.w - (mousePos.x - mLastCoords.x), 0);
                        pos.x = pos.x - (mLastCoords.x - mousePos.x);
                    }

                    if(resizeY == 1) {
                        size.h = Math.max(size.h + (mousePos.y - mLastCoords.y), 0);
                    } else if(resizeY == -1) {
                        size.h = Math.max(size.h - (mousePos.y - mLastCoords.y), 0);
                        pos.y = pos.y - (mLastCoords.y - mousePos.y);
                    }
                    layer.setSize(size.w, size.h);
                    layer.setPos(pos.x, pos.y);
                    layer.render();
                }
            }
            mLastCoords = eventToPosition(e);
        }

        function handleClick() {
            if(mMouseDownNode) {
            }
        }

        function keyboardStart() {
            $(document).keydown(handleKeyDown);
            $(document).keyup(handleKeyUp);
        }

        function handleKeyDown(e) {
            mPressedKeys[e.keyCode] = true;
            switch(e.keyCode) {
                case 37: // left arrow
                    keyboardNudge(37, -1, 0);
                    break;
                case 38: // up arrow
                    keyboardNudge(38, 0, -1);
                    break;
                case 39: // right arrow
                    keyboardNudge(39, 1, 0);
                    break;
                case 40: // down arrow
                    keyboardNudge(40, 0, 1);
                    break;
            }
        }

        function handleKeyUp(e) {
            if(e.keyCode in mPressedKeys) {
                delete mPressedKeys[e.keyCode]
            };
            console.log(e.keyCode);
            switch(e.keyCode) {
                case 27: // esc
                    self.selectLayer(null);
                    break;
                case 8: // backspace
                case 46: // delete
                    if(mSelectedLayer) {
                        deleteLayer(mSelectedLayer);
                    }
                    break;
            }
        }

        function keyboardNudge(keyCode, dx, dy) {
            if(mPressedKeys[keyCode] && mSelectedLayer) {
                var pos = mSelectedLayer.getPos();
                mSelectedLayer.setPos(pos.x + dx, pos.y + dy);
                _.delay(keyboardNudge, 200, dx, dy);
            }
        }

        function keyboardStop() {
            $(document).off('keydown', handleKeyDown);
            $(document).off('keyup', handleKeyUp);
        }

        function handleBackgroundChange(colour) {
            mNode.css({
                'background-color': colour.css
            });
        }

        function handleFullscreenChange(fullscreen) {
            if(fullscreen) {
                mNode.css({
                    'margin-top': 0,
                    'height': 168
                });
            } else {
                mNode.css({
                    'margin-top': STATUS_BAR_HEIGHT * mScaleY,
                    'height': 168 - STATUS_BAR_HEIGHT
                });
            }
        }

        function deleteLayer(layer) {
            if(!layer) {
                return;
            }
            if(layer == mSelectedLayer) {
                self.selectLayer(null);
            }
            layer.destroy();
            mChildren = _.without(mChildren, layer);
            layer = null;
        }

        this.selectLayer = function(layer) {
            if(layer == mSelectedLayer) {
                return;
            }
            if(mResizer != null) {
                mResizer.destroy();
                keyboardStop();
                mResizer = null;
            }
            if(layer) {
                mResizer = new IB.Resizer(mNode, layer);
                keyboardStart();
            }
            mSelectedLayer = layer;
            self.trigger('selection', mSelectedLayer);
        };

        /**
         *
         * @param {IB.Layer} layer
         */
        this.addLayer = function(layer) {
            mChildren.push(layer);
            layer.setCanvas(self);
            layer.render(mNode);
        };

        this.addLayers = _.partial(_.each, _, this.addLayer, this);

        this.getLayers = function() {
            return mChildren;
        };

        this.clear = function() {
            mChildren = [];
            mNode.empty();
        };

        this.generateDeclaration = function() {
            return ["static Window *s_window;"];
        };

        this.generateInitialiser = function() {
            var initialiser = ["s_window = window_create();"];
            if(mProperties.bg.getValue() != IB.ColourWhite) {
                initialiser.push("window_set_background_color(s_window, " + mProperties.bg.getValue() + ");");
            }
            initialiser.push("window_set_fullscreen(s_window, " + mProperties.fullscreen.getValue() + ");");
            return initialiser;
        };

        this.generateDestructor = function() {
            return ["window_destroy(s_window);"];
        };

        this.readPropertes = function(properties) {
            _.each(properties, function(values, property) {
                switch(property) {
                    case "window_set_background_color":
                        mProperties.bg.setValue(IB.ColourMap[values[1]]);
                        break;
                    case "window_set_fullscreen":
                        mProperties.fullscreen.setValue(JSON.parse(values[1]));
                        break;
                }
            }, this);
        };

        this.getProperties = function() {
            return mProperties;
        };

        this.isFullscreen = function() {
            return mProperties.fullscreen.getValue();
        };

        init(parent);
    };
})();
