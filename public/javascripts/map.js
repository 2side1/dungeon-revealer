define(['settings', 'jquery', 'brush'], function (settings, jquery, brush) {
    console.log('map module running');
    return function () {
        var $ = jquery,
            fowContext,
            fowCanvas,
            mapImageContext,
            mapImageCanvas,
            fowBrush,
            mapImage,
            width,
            height;

        function create(parentElem, imgUrl, opts, callback) {
            //TODO: better way to override individual settings properties?
            opts = opts || settings;
            imgUrl = imgUrl || opts.mapImage;

            mapImage = new Image();
            mapImage.onload = function () {
                var container,
                    canvases,
                    dimensions;

                console.log('mapImage loaded');

                dimensions = getOptimalDimensions(mapImage.width, mapImage.height, opts.maxWidth, opts.maxHeight);
                width = dimensions.width;
                height = dimensions.height;
                console.log("width: " + width + ", height: " + height);
                container = getContainer();
                canvases = createCanvases();
                parentElem.appendChild(container);
                mapImageCanvas = canvases.mapImageCanvas;
                fowCanvas = canvases.fowCanvas;
                container.appendChild(mapImageCanvas);
                container.appendChild(fowCanvas);
                mapImageContext = mapImageCanvas.getContext('2d');
                fowContext = fowCanvas.getContext('2d');
                copyCanvas(mapImageContext, createImageCanvas(mapImage));
                fowBrush = brush(fowContext, opts);
                fowContext.strokeStyle = fowBrush.getCurrent();

                fogMap();
                //setUpEvents();
                //createPreview();
                //console.log(brush);
                setUpDrawingEvents();
                callback();
            };
            mapImage.crossOrigin = 'Anonymous'; // to prevent tainted canvas errors
            mapImage.src = imgUrl;


        }

        // TODO: account for multiple containers
        function getContainer() {
            var container = document.getElementById('canvasContainer') || document.createElement('div');
            container.id = 'canvasContainer'; //TODO: wont work for multiple containers
            container.style.position = 'relative';
            container.style.top = '0';
            container.style.left = '0';
            container.style.margin = 'auto';
            container.style.width = width + 'px';
            container.style.height = height + 'px';
            return container;
        }

        function createCanvases() {

            function createCanvas(type, zIndex) {
                console.log('creating canvas ' + type);
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.id = type + Math.floor(Math.random()*100000);
                canvas.className = type;
                canvas.style.position = 'absolute';
                canvas.style.left = '0';
                canvas.style.top = '0';
                canvas.style.zIndex = zIndex;
                zIndex++;

                return canvas;
            }

            return {
                mapImageCanvas: createCanvas('map-image-canvas', 1),
                fowCanvas: createCanvas('fow-canvas', 2)
            };

        }

        function getMouseCoordinates(e) {
            var viewportOffset = fowCanvas.getBoundingClientRect(),
                borderTop = parseInt($(fowCanvas).css('border-top-width')),
                borderLeft = parseInt($(fowCanvas).css('border-left-width'));
            return {
                x: e.clientX - viewportOffset.left - borderLeft,
                y: e.clientY - viewportOffset.top - borderTop
            };
        }

        function midPointBtw(p1, p2) {
            return {
                x: p1.x + (p2.x - p1.x) / 2,
                y: p1.y + (p2.y - p1.y) / 2
            };
        }

        function getOptimalDimensions(idealWidth, idealHeight, maxWidth, maxHeight) {
            console.log(arguments);
            var ratio = Math.min(maxWidth / idealWidth, maxHeight / idealHeight);
            console.log(ratio);
            return {
                width: idealWidth * ratio,
                height: idealHeight * ratio
            };
        }

        function convertCanvasToImage(canvas) {
            var image = new Image();

            image.src = canvas.toDataURL('image/png');
            return image;
        }

        function copyCanvas(context, canvasToCopy) {
            context.drawImage(canvasToCopy, 0, 0, width, height);
        }

        function mergeCanvas(bottomCanvas, topCanvas) {
            var mergedCanvas = document.createElement('canvas'),
                mergedContext = mergedCanvas.getContext('2d');

            mergedCanvas.width = width;
            mergedCanvas.height = height;
            copyCanvas(mergedContext, bottomCanvas);
            copyCanvas(mergedContext, topCanvas);

            return mergedCanvas;
        }

        // Creates a canvas from an image
        function createImageCanvas(img) {
            var imageCanvas = document.createElement('canvas'),
                imageContext = imageCanvas.getContext('2d'),
                width = settings.maxWidth,
                height = settings.maxHeight;

            imageCanvas.width = width;
            imageCanvas.height = height;
            imageContext.drawImage(img, 0, 0, width, height);

            return imageCanvas;
        }

        function resetMap(context, brushType, brush) {
            context.save();
            context.fillStyle = brush.getPattern(brushType);
            context.fillRect(0, 0, width, height);
            context.restore();
        }

        function fogMap() {
            resetMap(fowContext, 'fog', fowBrush);
        }

        function clearMap(context) {
            resetMap(context, 'clear');
        }

        function resize(displayWidth, displayHeight) {
            fowCanvas.style.width = displayWidth;
            fowCanvas.style.height = displayHeight;
            mapImageCanvas.style.width = displayWidth + 'px';
            mapImageCanvas.style.height = displayHeight + 'px';
        }

        // Maybe having this here violates cohesion
        function fitMapToWindow() {
            var oldWidth = parseInt(mapImageCanvas.style.width || mapImageCanvas.width, 10),
                oldHeight = parseInt(mapImageCanvas.style.height || mapImageCanvas.height, 10),
                // Using Infinity for new height so as not to limit the image size's width because
                // the height was too large. We want to fill the available width.
                newDims = getOptimalDimensions(oldWidth, oldHeight, window.innerWidth, Infinity);

            resize(newDims.width, newDims.height);
        }

        function toImage() {
            return convertCanvasToImage(mergeCanvas(mapImageCanvas, fowCanvas));
        }

        function remove() {
            // won't work in IE
            mapImageCanvas.remove();
            fowCanvas.remove();
        }

        function setUpDrawingEvents() {
            mapImageCanvas.onmousedown = function (e) {
                isDrawing = true;
                var coords = getMouseCoordinates(e);
                points.push(coords);
                // Draw a circle as the start of the brush stroke
                mapImageContext.beginPath();
                mapImageContext.arc(coords.x, coords.y, lineWidth / 2, 0, Math.PI * 2, true);
                mapImageContext.closePath();
                mapImageContext.fill();
            };

            mapImageCanvas.onmousemove = function (e) {
                if (!isDrawing) return;

                points.push(getMouseCoordinates(e));

                var p1 = points[0],
                    p2 = points[1];

                mapImageContext.beginPath();
                mapImageContext.moveTo(p1.x, p1.y);
                mapImageContext.lineWidth = lineWidth;
                mapImageContext.lineJoin = mapImageContext.lineCap = 'round';

                for (var i = 1, len = points.length; i < len; i++) {
                    var midPoint = midPointBtw(p1, p2);
                    mapImageContext.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
                    p1 = points[i];
                    p2 = points[i + 1];
                }
                mapImageContext.lineTo(p1.x, p1.y);
                mapImageContext.stroke();
            };


            $('#btn-toggle-brush').click(function () {
                var toggleButton = this;
                if (toggleButton.innerHTML === "Clear Brush") {
                    toggleButton.innerHTML = "Shadow Brush";
                } else {
                    toggleButton.innerHTML = "Clear Brush";
                }
                brush.toggle();
            });
            $('#btn-shroud-all').click(function () {
                fogBoard(mapImageContext);
                //createPlayerMapImage(mapCanvas, mapImageCanvas);
            });
            $('#btn-clear-all').click(function () {
                clearBoard(mapImageContext);
                //createPlayerMapImage(mapCanvas, mapImageCanvas);
            });

            $('#btn-enlarge-brush').click(function () {
                // If the new width would be over 200, set it to 200
                lineWidth = (lineWidth * 2 > 200) ? 200 : lineWidth * 2;
            });

            $('#btn-shrink-brush').click(function () {
                // If the new width would be less than 1, set it to 1
                lineWidth = (lineWidth / 2 < 1) ? 1 : lineWidth / 2;
            });

            $('#btn-preview').click(function () {
                createPreview();
            });

            $('#btn-send').click(function () {
                var imageData = document.getElementById('preview').src;

                var jqxhr = $.post('upload',
                    {
                        "imageData": imageData
                    },
                    function (e) {
                    })
                    .done(function (e) {
                    })
                    .fail(function (e) {
                    })
                    .always(function (e) {
                        if (e.success) {
                            console.log(e.responseText);
                        } else {
                            console.error(e.responseText);
                        }
                    });
            });

            document.addEventListener("mouseup", function () {
                stopDrawing();
            });
        }

        function stopDrawing() {
            if (isDrawing) {
                createPreview();
            }
            isDrawing = false;
            points.length = 0;
        }

        return {
            create: create,
            toImage: toImage,
            resize: resize,
            remove: remove,
            fitMapToWindow: fitMapToWindow
        };

    };
});