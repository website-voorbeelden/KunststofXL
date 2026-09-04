(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function num(value, fallback) {
    var parsed = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function measure(value) {
    return Number(value.toFixed(1)).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  }

  function money(cents, locale, currency) {
    return new Intl.NumberFormat(locale || 'nl-NL', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(cents / 100);
  }

  function attrs(element, values) {
    if (!element) return;
    Object.keys(values).forEach(function (key) { element.setAttribute(key, values[key]); });
  }

  function showSvg(element, visible) {
    if (!element) return;
    if (visible) {
      element.removeAttribute('hidden');
      element.style.display = '';
    } else {
      element.setAttribute('hidden', '');
      element.style.display = 'none';
    }
  }

  function initialise(root) {
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    var one = function (selector) { return root.querySelector(selector); };
    var all = function (selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); };

    var widthInput = one('[data-pc-width]');
    var heightInput = one('[data-pc-height]');
    var radiusInput = one('[data-pc-radius]');
    var roundedToggle = one('[data-pc-rounded]');
    var letterInput = one('[data-pc-letter]');
    var letterFontSelect = one('[data-pc-letter-font]');
    var widthError = one('[data-pc-width-error]');
    var heightError = one('[data-pc-height-error]');
    var holesToggle = one('[data-pc-holes]');
    var holeDiameterInput = one('[data-pc-hole-diameter]');
    var cutoutToggle = one('[data-pc-cutout]');
    var cutoutSizeInput = one('[data-pc-cutout-size]');
    var uploadInput = one('[data-pc-upload]');
    var uploadTrigger = one('[data-pc-upload-trigger]');

    var svg = one('.pc-svg');
    var canvas = one('.pc-canvas');
    var productImage = one('.pc-product-image');
    var shapePath = one('.pc-shape');
    var letterShape = one('.pc-letter-shape');
    var holesLayer = one('.pc-holes');
    var cutoutLayer = one('.pc-cutout-layer');
    var cutoutCircle = one('.pc-cutout-circle');

    if (!widthInput || !heightInput || !svg || !shapePath) return;

    holesToggle.checked = false;
    cutoutToggle.checked = false;
    if (roundedToggle) roundedToggle.checked = false;

    var minimumWidth = num(root.dataset.minWidth, 2);
    var minimumHeight = num(root.dataset.minHeight, 2);
    var maximumWidth = num(root.dataset.maxWidth, 305);
    var maximumHeight = num(root.dataset.maxHeight, 155);
    var basePrice = Math.max(1, num(root.dataset.basePrice, 1000));

    var state = {
      shape: 'rectangle',
      mainMode: 'rectangle',
      view: 'dimensions',
      thickness: 2,
      holes: false,
      cutout: false,
      rounded: false,
      letterSizeMode: 'height',
      letterFont: 'Arial, sans-serif',
      finish: 'gezaagd',
      quantity: 1,
      validWidth: 10,
      validHeight: 10,
      dimensionsValid: true
    };

    var toastTimer;

    function notify(message) {
      var toast = one('[data-pc-toast]');
      if (!toast) return;
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.hidden = false;
      toastTimer = window.setTimeout(function () { toast.hidden = true; }, 2200);
    }

    function letters(input) {
      var value = String(input.value || 'A').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 8);
      if (!value) value = 'A';
      if (input.value !== value) input.value = value;
      return value.toUpperCase();
    }

    function letterMetric(text) {
      var factor = 0.62;
      if (state.letterFont.indexOf('Trebuchet') !== -1) factor = 0.64;
      if (state.letterFont.indexOf('Georgia') !== -1) factor = 0.66;
      if (state.letterFont.indexOf('Impact') !== -1) factor = 0.56;
      return Math.max(0.65, text.length * factor);
    }

    function clearDimensionError(input, error) {
      input.setAttribute('aria-invalid', 'false');
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
    }

    function readDimension(input, error, label, minimum, maximum, fallback) {
      var raw = String(input.value == null ? '' : input.value).trim();
      var value = num(raw, NaN);
      var message = '';

      if (!raw || !Number.isFinite(value)) {
        message = 'Vul een geldige ' + label.toLowerCase() + ' in.';
      } else if (value < minimum) {
        message = label + ' is te klein. Kies minimaal ' + measure(minimum) + ' cm.';
      } else if (value > maximum) {
        message = label + ' is te groot. Kies maximaal ' + measure(maximum) + ' cm.';
      }

      input.setAttribute('aria-invalid', String(Boolean(message)));
      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }

      return {
        valid: !message,
        value: message ? fallback : value
      };
    }

    function setOrderAvailability(valid) {
      all('[data-pc-cart]').forEach(function (button) {
        button.disabled = !valid;
        button.setAttribute('aria-disabled', String(!valid));
      });
    }

    function values() {
      var width = state.validWidth;
      var height = state.validHeight;
      var text = letters(letterInput);
      var widthResult;
      var heightResult;

      if (state.shape === 'circle') {
        widthResult = readDimension(
          widthInput,
          widthError,
          'Diameter',
          Math.max(minimumWidth, minimumHeight),
          Math.min(maximumWidth, maximumHeight),
          state.validWidth
        );
        clearDimensionError(heightInput, heightError);
        if (widthResult.valid) state.validWidth = widthResult.value;
        width = state.validWidth;
        height = width;
        state.validHeight = height;
        heightInput.value = Number(height.toFixed(1));
        state.dimensionsValid = widthResult.valid;
      } else if (state.shape === 'letter') {
        var metric = letterMetric(text);
        var letterMaximumWidth = Math.min(maximumWidth, maximumHeight * metric);
        var letterMaximumHeight = Math.min(maximumHeight, maximumWidth / metric);

        if (state.letterSizeMode === 'width') {
          clearDimensionError(heightInput, heightError);
          widthResult = readDimension(widthInput, widthError, 'Breedte', minimumWidth, letterMaximumWidth, state.validWidth);
          if (widthResult.valid) state.validWidth = widthResult.value;
          width = state.validWidth;
          height = width / metric;
          state.validHeight = height;
          heightInput.value = Number(height.toFixed(1));
          state.dimensionsValid = widthResult.valid;
        } else {
          clearDimensionError(widthInput, widthError);
          heightResult = readDimension(heightInput, heightError, 'Hoogte', minimumHeight, letterMaximumHeight, state.validHeight);
          if (heightResult.valid) state.validHeight = heightResult.value;
          height = state.validHeight;
          width = height * metric;
          state.validWidth = width;
          widthInput.value = Number(width.toFixed(1));
          state.dimensionsValid = heightResult.valid;
        }
      } else {
        widthResult = readDimension(widthInput, widthError, 'Breedte', minimumWidth, maximumWidth, state.validWidth);
        heightResult = readDimension(heightInput, heightError, 'Hoogte', minimumHeight, maximumHeight, state.validHeight);
        if (widthResult.valid) state.validWidth = widthResult.value;
        if (heightResult.valid) state.validHeight = heightResult.value;
        width = state.validWidth;
        height = state.validHeight;
        state.dimensionsValid = widthResult.valid && heightResult.valid;
      }

      setOrderAvailability(state.dimensionsValid);
      return { width: width, height: height, text: text, valid: state.dimensionsValid };
    }

    function setLine(selector, x1, y1, x2, y2) {
      attrs(one(selector), { x1: x1, y1: y1, x2: x2, y2: y2 });
    }

    function setDimensionLabel(textSelector, backgroundSelector, x, y, text) {
      var label = one(textSelector);
      var background = one(backgroundSelector);
      if (!label || !background) return;
      label.textContent = text;
      attrs(label, { x: x, y: y });
      var labelWidth = Math.max(58, text.length * 7.6 + 14);
      attrs(background, { x: x - labelWidth / 2, y: y - 11, width: labelWidth, height: 22 });
    }

    function updateFieldVisibility() {
      var pickerPanel = one('[data-pc-picker-panel]');
      var uploadPanel = one('[data-pc-upload-panel]');
      var widthField = one('[data-pc-width-field]');
      var heightField = one('[data-pc-height-field]');
      var radiusField = one('[data-pc-radius-field]');
      var roundedOption = one('[data-pc-rounded-option]');
      var letterSettings = one('[data-pc-letter-settings]');
      var letterField = one('[data-pc-letter-field]');
      var widthLabel = one('[data-pc-width-label]');
      var heightLabel = one('[data-pc-height-label]');
      var widthMax = one('[data-pc-width-max]');
      var heightLimits = one('[data-pc-height-limits]');
      var radiusMax = one('[data-pc-radius-max]');

      if (pickerPanel) pickerPanel.hidden = state.mainMode !== 'picker';
      if (uploadPanel) uploadPanel.hidden = state.mainMode !== 'upload';
      widthField.hidden = state.shape === 'letter' && state.letterSizeMode !== 'width';
      heightField.hidden = state.shape === 'circle' || (state.shape === 'letter' && state.letterSizeMode === 'width');
      if (roundedOption) roundedOption.hidden = state.shape !== 'rectangle';
      if (radiusField) radiusField.hidden = state.shape !== 'rectangle' || !state.rounded;
      if (letterSettings) letterSettings.hidden = state.shape !== 'letter';
      letterField.hidden = state.shape !== 'letter';
      if (roundedToggle) roundedToggle.checked = state.rounded;

      if (widthLabel) widthLabel.textContent = state.shape === 'circle' ? 'Diameter' : state.shape === 'letter' ? 'Letterbreedte' : 'Breedte';
      if (heightLabel) heightLabel.textContent = state.shape === 'letter' ? 'Letterhoogte' : 'Hoogte';
      if (widthMax) {
        var shownMaximum = state.shape === 'circle'
          ? Math.min(maximumWidth, maximumHeight)
          : state.shape === 'letter'
            ? Math.min(maximumWidth, maximumHeight * letterMetric(letters(letterInput)))
            : maximumWidth;
        widthMax.textContent = 'Max. ' + measure(shownMaximum) + ' cm';
      }
      if (heightLimits) {
        var shownHeightMaximum = state.shape === 'letter'
          ? Math.min(maximumHeight, maximumWidth / letterMetric(letters(letterInput)))
          : maximumHeight;
        heightLimits.textContent = 'Max. ' + measure(shownHeightMaximum) + ' cm';
      }
      all('[data-pc-letter-size-mode]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.pcLetterSizeMode === state.letterSizeMode));
      });
      if (letterFontSelect && letterFontSelect.value !== state.letterFont) letterFontSelect.value = state.letterFont;

      var halfShortSide = Math.max(0.1, Math.min(state.validWidth, state.validHeight) / 2);
      radiusInput.max = Number(halfShortSide.toFixed(1));
      if (radiusMax) radiusMax.textContent = 'Max. ' + measure(halfShortSide) + ' cm';

      all('[data-pc-main-shape]').forEach(function (button) {
        var selected = button.dataset.pcMainShape === state.mainMode;
        button.setAttribute('aria-selected', String(selected));
        if (button.hasAttribute('aria-expanded')) button.setAttribute('aria-expanded', String(selected));
      });
      all('[data-pc-shape]').forEach(function (button) {
        var selectedShape = button.dataset.pcShape === state.shape;
        if (button.dataset.pcShape === 'rounded') {
          selectedShape = state.shape === 'rectangle' && state.rounded && state.mainMode === 'picker';
        }
        button.setAttribute('aria-pressed', String(selectedShape));
      });
    }

    function renderView() {
      var imageMode = state.view === 'image';
      svg.hidden = imageMode;
      svg.style.display = imageMode ? 'none' : 'block';
      if (productImage) {
        productImage.hidden = !imageMode;
        productImage.style.display = imageMode
          ? (productImage.classList.contains('pc-product-image--empty') ? 'grid' : 'block')
          : 'none';
      }
      canvas.classList.toggle('is-image', imageMode);
      all('[data-pc-view]').forEach(function (button) {
        button.setAttribute('aria-selected', String(button.dataset.pcView === state.view));
      });
    }

    function renderOuterShape(box, currentValues) {
      var x = box.x;
      var y = box.y;
      var width = box.width;
      var height = box.height;

      showSvg(shapePath, state.shape !== 'letter');
      showSvg(letterShape, state.shape === 'letter');

      if (state.shape === 'letter') {
        letterShape.textContent = currentValues.text;
        var fontSize = Math.min(height, width / letterMetric(currentValues.text));
        attrs(letterShape, { x: 350, y: 225, 'font-size': fontSize, 'font-family': state.letterFont });
        return;
      }

      if (state.shape === 'circle') {
        var circleRadius = Math.min(width, height) / 2;
        shapePath.setAttribute('d',
          'M ' + (350 - circleRadius) + ' 225 ' +
          'a ' + circleRadius + ' ' + circleRadius + ' 0 1 0 ' + circleRadius * 2 + ' 0 ' +
          'a ' + circleRadius + ' ' + circleRadius + ' 0 1 0 -' + circleRadius * 2 + ' 0'
        );
        return;
      }

      if (state.shape === 'rectangle' && state.rounded) {
        var radiusCm = clamp(num(radiusInput.value, 1), 0.1, Math.min(currentValues.width, currentValues.height) / 2);
        radiusInput.value = Number(radiusCm.toFixed(1));
        var radius = radiusCm * box.scale;
        shapePath.setAttribute('d',
          'M ' + (x + radius) + ' ' + y +
          ' H ' + (x + width - radius) +
          ' Q ' + (x + width) + ' ' + y + ' ' + (x + width) + ' ' + (y + radius) +
          ' V ' + (y + height - radius) +
          ' Q ' + (x + width) + ' ' + (y + height) + ' ' + (x + width - radius) + ' ' + (y + height) +
          ' H ' + (x + radius) +
          ' Q ' + x + ' ' + (y + height) + ' ' + x + ' ' + (y + height - radius) +
          ' V ' + (y + radius) +
          ' Q ' + x + ' ' + y + ' ' + (x + radius) + ' ' + y + ' Z'
        );
        return;
      }

      shapePath.setAttribute('d',
        'M ' + x + ' ' + y + ' H ' + (x + width) + ' V ' + (y + height) + ' H ' + x + ' Z'
      );
    }

    function renderHoles(box) {
      while (holesLayer.firstChild) holesLayer.removeChild(holesLayer.firstChild);
      if (!state.holes) return;

      var diameter = clamp(num(holeDiameterInput.value, 8), 3, 30);
      holeDiameterInput.value = Number(diameter.toFixed(1));
      var holeRadius = clamp((diameter / 10) * box.scale / 2, 1.5, 18);
      var offsetX = box.width * 0.39;
      var offsetY = box.height * 0.38;
      var positions = [
        [-offsetX, -offsetY],
        [offsetX, -offsetY],
        [offsetX, offsetY],
        [-offsetX, offsetY]
      ];

      positions.forEach(function (position) {
        var hole = document.createElementNS(SVG_NS, 'circle');
        hole.setAttribute('class', 'pc-hole');
        attrs(hole, {
          cx: 350 + position[0],
          cy: 225 + position[1],
          r: holeRadius
        });
        holesLayer.appendChild(hole);
      });
    }

    function renderCutout(box, currentValues) {
      showSvg(cutoutLayer, state.cutout);
      if (!state.cutout) return;

      var maximumSize = Math.max(1, Math.min(currentValues.width, currentValues.height) * 0.7);
      var sizeCm = clamp(num(cutoutSizeInput.value, 3), 1, maximumSize);
      cutoutSizeInput.value = Number(sizeCm.toFixed(1));
      var size = sizeCm * box.scale;
      attrs(cutoutCircle, { cx: 350, cy: 225, r: size / 2 });
    }

    function renderDimensions(box, currentValues) {
      var widthExtA = one('.pc-w-ext-a');
      var widthExtB = one('.pc-w-ext-b');
      var heightExtA = one('.pc-h-ext-a');
      var heightExtB = one('.pc-h-ext-b');
      var heightDimension = one('.pc-dim-h');
      var heightLabel = one('.pc-label-h');
      var heightLabelBackground = one('.pc-label-h-bg');
      var isCircle = state.shape === 'circle';

      showSvg(widthExtA, true);
      showSvg(widthExtB, true);
      showSvg(heightExtA, !isCircle);
      showSvg(heightExtB, !isCircle);
      showSvg(heightDimension, !isCircle);
      showSvg(heightLabel, !isCircle);
      showSvg(heightLabelBackground, !isCircle);

      var horizontalY = box.y + box.height + 48;
      var verticalX = box.x - 50;
      var curvedShape = isCircle || (state.shape === 'rectangle' && state.rounded);
      var widthGuideStartY = curvedShape ? 225 : box.y + box.height + 4;
      var heightGuideStartX = curvedShape ? 350 : box.x - 4;

      setLine('.pc-w-ext-a', box.x, widthGuideStartY, box.x, horizontalY + 7);
      setLine('.pc-w-ext-b', box.x + box.width, widthGuideStartY, box.x + box.width, horizontalY + 7);
      setLine('.pc-dim-w', box.x, horizontalY, box.x + box.width, horizontalY);
      setDimensionLabel(
        '.pc-label-w',
        '.pc-label-w-bg',
        350,
        horizontalY,
        (isCircle ? 'Ø ' : '') + measure(currentValues.width) + ' cm'
      );

      if (isCircle) return;

      setLine('.pc-h-ext-a', heightGuideStartX, box.y, verticalX - 7, box.y);
      setLine('.pc-h-ext-b', heightGuideStartX, box.y + box.height, verticalX - 7, box.y + box.height);
      setLine('.pc-dim-h', verticalX, box.y, verticalX, box.y + box.height);
      setDimensionLabel('.pc-label-h', '.pc-label-h-bg', verticalX, 225, measure(currentValues.height) + ' cm');
    }

    function shapeLabel(currentValues) {
      if (state.shape === 'circle') return 'Cirkel · Ø ' + measure(currentValues.width) + ' cm';
      if (state.shape === 'letter') {
        var letterMeasure = state.letterSizeMode === 'width'
          ? measure(currentValues.width) + ' cm breed'
          : measure(currentValues.height) + ' cm hoog';
        var fontName = state.letterFont.split(',')[0].replace(/'/g, '');
        return 'Letters “' + currentValues.text + '” · ' + letterMeasure + ' · ' + fontName;
      }
      if (state.rounded) {
        return 'Rechthoek · ' + measure(currentValues.width) + ' × ' + measure(currentValues.height) + ' cm · R ' + measure(num(radiusInput.value, 1)) + ' cm';
      }
      return 'Rechthoek · ' + measure(currentValues.width) + ' × ' + measure(currentValues.height) + ' cm';
    }

    function priceParts(currentValues) {
      var areaPart = currentValues.width * currentValues.height / (305 * 155);
      var thicknessPart = 0.82 + state.thickness * 0.09;
      var shapePart = state.shape === 'rectangle' ? (state.rounded ? 1.08 : 1) : 1.12;
      var material = Math.max(basePrice, Math.round((basePrice + areaPart * 6100) * thicknessPart));
      var shape = Math.max(0, Math.round(material * (shapePart - 1)));
      var extras = (state.holes ? 4 * 65 : 0) +
        (state.cutout ? 425 : 0) +
        (state.finish === 'gefreesd' ? 550 : 0);
      return {
        material: material,
        shape: shape,
        extras: extras,
        total: material + shape + extras
      };
    }

    function updateSummary(currentValues, pricing) {
      var dimensionsText = state.shape === 'circle'
        ? 'Ø ' + measure(currentValues.width) + ' cm'
        : state.shape === 'letter'
          ? currentValues.text + ' · ' + (state.letterSizeMode === 'width'
            ? measure(currentValues.width) + ' cm breed'
            : measure(currentValues.height) + ' cm hoog')
          : measure(currentValues.width) + ' × ' + measure(currentValues.height) + ' cm';

      var holeDiameter = clamp(num(holeDiameterInput.value, 8), 3, 30);
      var cutoutDiameter = clamp(num(cutoutSizeInput.value, 3), 1, Math.min(currentValues.width, currentValues.height) * 0.7);
      if (state.shape === 'rectangle' && state.rounded) {
        dimensionsText += ' · R ' + measure(num(radiusInput.value, 1)) + ' cm';
      }
      var compact = dimensionsText + ' · ' + state.thickness + ' mm' +
        (state.holes ? ' · 4 hoekgaten Ø ' + measure(holeDiameter) + ' mm' : '') +
        (state.cutout ? ' · ronde uitsnede Ø ' + measure(cutoutDiameter) + ' cm' : '');

      var shapeSummary = one('[data-pc-shape-summary]');
      var thicknessSummary = one('[data-pc-thickness-summary]');
      var holesSummary = one('[data-pc-holes-summary]');
      var cutoutSummary = one('[data-pc-cutout-summary]');
      var finishSummary = one('[data-pc-finish-summary]');

      if (shapeSummary) shapeSummary.textContent = shapeLabel(currentValues);
      if (thicknessSummary) thicknessSummary.textContent = state.thickness + ' mm';
      if (holesSummary) holesSummary.textContent = state.holes ? '4 hoekgaten · Ø ' + measure(holeDiameter) + ' mm' : 'Geen';
      if (cutoutSummary) cutoutSummary.textContent = state.cutout
        ? 'Rond · Ø ' + measure(cutoutDiameter) + ' cm'
        : 'Geen';
      if (finishSummary) finishSummary.textContent = state.finish === 'gefreesd' ? 'Gefreesd' : 'Gezaagd';

      all('[data-pc-summary]').forEach(function (element) { element.textContent = compact; });
      all('[data-pc-price]').forEach(function (element) {
        element.textContent = money(pricing.total * state.quantity, root.dataset.locale, root.dataset.currency);
      });

      var materialPrice = one('[data-pc-breakdown-material]');
      var shapePrice = one('[data-pc-breakdown-shape]');
      var extrasPrice = one('[data-pc-breakdown-extras]');
      var breakdownTotal = one('[data-pc-breakdown-total]');
      if (materialPrice) materialPrice.textContent = money(pricing.material, root.dataset.locale, root.dataset.currency);
      if (shapePrice) shapePrice.textContent = money(pricing.shape, root.dataset.locale, root.dataset.currency);
      if (extrasPrice) extrasPrice.textContent = money(pricing.extras, root.dataset.locale, root.dataset.currency);
      if (breakdownTotal) breakdownTotal.textContent = money(pricing.total, root.dataset.locale, root.dataset.currency);

      var holesStatus = one('[data-pc-holes-status]');
      var cutoutStatus = one('[data-pc-cutout-status]');
      if (holesStatus) {
        holesStatus.textContent = state.holes ? '✓' : '';
        holesStatus.classList.toggle('pc-status--done', state.holes);
      }
      if (cutoutStatus) {
        cutoutStatus.textContent = state.cutout ? '✓' : '';
        cutoutStatus.classList.toggle('pc-status--done', state.cutout);
      }
    }

    function render() {
      var currentValues = values();
      updateFieldVisibility();
      renderView();
      var scale = Math.min(430 / currentValues.width, 260 / currentValues.height);
      var renderedWidth = currentValues.width * scale;
      var renderedHeight = currentValues.height * scale;
      var box = {
        x: 350 - renderedWidth / 2,
        y: 225 - renderedHeight / 2,
        width: renderedWidth,
        height: renderedHeight,
        scale: scale
      };

      renderOuterShape(box, currentValues);
      renderHoles(box);
      renderCutout(box, currentValues);
      renderDimensions(box, currentValues);
      updateSummary(currentValues, priceParts(currentValues));
    }

    function chooseShape(shape) {
      var pickedRoundedRectangle = shape === 'rounded';
      if (pickedRoundedRectangle) {
        shape = 'rectangle';
        state.rounded = true;
      }
      state.shape = shape;
      state.mainMode = pickedRoundedRectangle ? 'picker' : shape === 'rectangle' ? 'rectangle' : 'picker';
      state.view = 'dimensions';
      if (shape === 'circle') {
        var diameter = clamp(num(widthInput.value, 10), Math.max(minimumWidth, minimumHeight), Math.min(maximumWidth, maximumHeight));
        widthInput.value = diameter;
        heightInput.value = diameter;
      }
      render();
    }

    all('[data-pc-main-shape]').forEach(function (button) {
      button.addEventListener('click', function () {
        var mode = button.dataset.pcMainShape;
        if (mode === 'rectangle') {
          chooseShape('rectangle');
        } else if (mode === 'picker') {
          state.mainMode = 'picker';
          render();
        } else if (mode === 'upload') {
          state.mainMode = 'upload';
          render();
        }
      });
    });

    all('[data-pc-shape]').forEach(function (button) {
      button.addEventListener('click', function () { chooseShape(button.dataset.pcShape); });
    });

    all('[data-pc-open-upload]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.mainMode = 'upload';
        state.view = 'dimensions';
        render();
      });
    });

    if (uploadTrigger) {
      uploadTrigger.addEventListener('click', function () { uploadInput.click(); });
    }

    uploadInput.addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) {
        state.mainMode = state.shape === 'rectangle' ? 'rectangle' : 'picker';
        render();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        if (productImage && !productImage.classList.contains('pc-product-image--empty')) productImage.src = reader.result;
        var result = one('[data-pc-upload-result]');
        if (result) {
          result.textContent = '✓ ' + file.name + ' gekozen als voorbeeld';
          result.hidden = false;
        }
        state.mainMode = 'upload';
        state.view = 'image';
        render();
      };
      reader.readAsDataURL(file);
    });

    all('[data-pc-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.view = button.dataset.pcView;
        render();
      });
    });

    if (roundedToggle) {
      roundedToggle.addEventListener('change', function () {
        state.rounded = roundedToggle.checked;
        state.view = 'dimensions';
        render();
      });
    }

    all('[data-pc-letter-size-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.letterSizeMode = button.dataset.pcLetterSizeMode;
        state.view = 'dimensions';
        render();
      });
    });

    if (letterFontSelect) {
      letterFontSelect.addEventListener('change', function () {
        state.letterFont = letterFontSelect.value;
        state.view = 'dimensions';
        render();
      });
    }

    [widthInput, heightInput, radiusInput, letterInput].forEach(function (input) {
      input.addEventListener('input', function () {
        if (state.shape === 'circle') heightInput.value = widthInput.value;
        state.view = 'dimensions';
        render();
      });
    });

    all('[data-pc-thickness]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.thickness = num(button.dataset.pcThickness, 2);
        all('[data-pc-thickness]').forEach(function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        render();
      });
    });

    holesToggle.addEventListener('change', function () {
      state.holes = holesToggle.checked;
      one('[data-pc-holes-fields]').hidden = !state.holes;
      state.view = 'dimensions';
      render();
    });
    holeDiameterInput.addEventListener('input', function () { state.view = 'dimensions'; render(); });

    cutoutToggle.addEventListener('change', function () {
      state.cutout = cutoutToggle.checked;
      one('[data-pc-cutout-fields]').hidden = !state.cutout;
      state.view = 'dimensions';
      render();
    });

    cutoutSizeInput.addEventListener('input', function () {
      state.view = 'dimensions';
      render();
    });

    all('[data-pc-finish]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.finish = button.dataset.pcFinish;
        all('[data-pc-finish]').forEach(function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        render();
      });
    });

    all('.pc-accordion').forEach(function (details) {
      details.addEventListener('toggle', function () {
        if (!details.open) return;
        all('.pc-accordion').forEach(function (other) {
          if (other !== details) other.open = false;
        });
      });
    });

    var quantityDisplay = one('[data-pc-quantity]');
    function setQuantity(quantity) {
      state.quantity = clamp(quantity, 1, 99);
      quantityDisplay.textContent = state.quantity;
      render();
    }
    one('[data-pc-minus]').addEventListener('click', function () { setQuantity(state.quantity - 1); });
    one('[data-pc-plus]').addEventListener('click', function () { setQuantity(state.quantity + 1); });

    one('[data-pc-cart]').addEventListener('click', function () {
      notify('Conceptconfiguratie staat klaar voor de winkelmand.');
    });
    one('[data-pc-sample]').addEventListener('click', function () {
      notify('Sample-aanvraag is in deze conceptversie nog niet gekoppeld.');
    });

    render();
  }

  function boot(scope) {
    (scope || document).querySelectorAll('[data-plate-configurator]').forEach(initialise);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (event) { boot(event.target); });
}());
