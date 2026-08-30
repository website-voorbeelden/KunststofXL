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

  function initialise(root) {
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    var one = function (selector) { return root.querySelector(selector); };
    var all = function (selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); };

    var widthInput = one('[data-pc-width]');
    var heightInput = one('[data-pc-height]');
    var radiusInput = one('[data-pc-radius]');
    var letterInput = one('[data-pc-letter]');
    var holesToggle = one('[data-pc-holes]');
    var holeCountInput = one('[data-pc-hole-count]');
    var holeDiameterInput = one('[data-pc-hole-diameter]');
    var cutoutToggle = one('[data-pc-cutout]');
    var cutoutSizeInput = one('[data-pc-cutout-size]');
    var cutoutRadiusInput = one('[data-pc-cutout-radius]');
    var cutoutTextInput = one('[data-pc-cutout-text]');
    var uploadInput = one('[data-pc-upload]');

    var svg = one('.pc-svg');
    var canvas = one('.pc-canvas');
    var productImage = one('.pc-product-image');
    var shapePath = one('.pc-shape');
    var letterShape = one('.pc-letter-shape');
    var holesLayer = one('.pc-holes');
    var cutoutLayer = one('.pc-cutout-layer');
    var cutoutCircle = one('.pc-cutout-circle');
    var cutoutRect = one('.pc-cutout-rect');
    var cutoutText = one('.pc-cutout-text');

    if (!widthInput || !heightInput || !svg || !shapePath) return;

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
      cutoutType: 'circle',
      finish: 'gezaagd',
      quantity: 1
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

    function values() {
      var width = clamp(num(widthInput.value, 10), 1, maximumWidth);
      var height = clamp(num(heightInput.value, 10), 1, maximumHeight);
      var text = letters(letterInput);

      if (state.shape === 'circle') {
        width = clamp(width, 1, Math.min(maximumWidth, maximumHeight));
        height = width;
        heightInput.value = Number(height.toFixed(1));
      } else if (state.shape === 'letter') {
        width = Math.max(height * 0.65, height * text.length * 0.62);
        if (width > maximumWidth) {
          height = maximumWidth / Math.max(0.65, text.length * 0.62);
          width = maximumWidth;
        }
        heightInput.value = Number(height.toFixed(1));
      }

      widthInput.value = Number(width.toFixed(1));
      heightInput.value = Number(height.toFixed(1));

      return { width: width, height: height, text: text };
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
      var widthField = one('[data-pc-width-field]');
      var heightField = one('[data-pc-height-field]');
      var radiusField = one('[data-pc-radius-field]');
      var letterField = one('[data-pc-letter-field]');
      var widthLabel = one('[data-pc-width-label]');
      var widthMax = one('[data-pc-width-max]');

      if (pickerPanel) pickerPanel.hidden = state.mainMode !== 'picker';
      widthField.hidden = state.shape === 'letter';
      heightField.hidden = state.shape === 'circle';
      radiusField.hidden = state.shape !== 'rounded';
      letterField.hidden = state.shape !== 'letter';

      if (widthLabel) widthLabel.textContent = state.shape === 'circle' ? 'Diameter' : 'Breedte';
      if (widthMax) widthMax.textContent = 'Max: ' + (state.shape === 'circle' ? Math.min(maximumWidth, maximumHeight) : maximumWidth) + ' cm';

      var halfShortSide = Math.max(0, Math.min(num(widthInput.value, 10), num(heightInput.value, 10)) / 2);
      radiusInput.max = Number(halfShortSide.toFixed(1));

      all('[data-pc-main-shape]').forEach(function (button) {
        button.setAttribute('aria-selected', String(button.dataset.pcMainShape === state.mainMode));
      });
      all('[data-pc-shape]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.pcShape === state.shape));
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

      shapePath.hidden = state.shape === 'letter';
      letterShape.hidden = state.shape !== 'letter';

      if (state.shape === 'letter') {
        letterShape.textContent = currentValues.text;
        var fontSize = Math.min(height, width / Math.max(0.65, currentValues.text.length * 0.62));
        attrs(letterShape, { x: 350, y: 225, 'font-size': fontSize });
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

      if (state.shape === 'rounded') {
        var radiusCm = clamp(num(radiusInput.value, 2), 0, Math.min(currentValues.width, currentValues.height) / 2);
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

      var count = clamp(Math.round(num(holeCountInput.value, 4)), 1, 12);
      var diameter = clamp(num(holeDiameterInput.value, 8), 3, 50);
      holeCountInput.value = count;
      holeDiameterInput.value = Number(diameter.toFixed(1));

      var holeRadius = clamp((diameter / 10) * box.scale / 2, 3.3, 15);
      var orbitX = box.width * 0.37;
      var orbitY = box.height * 0.35;

      for (var index = 0; index < count; index += 1) {
        var angle = index / count * Math.PI * 2 - Math.PI / 2;
        var hole = document.createElementNS(SVG_NS, 'circle');
        hole.setAttribute('class', 'pc-hole');
        attrs(hole, {
          cx: 350 + Math.cos(angle) * orbitX,
          cy: 225 + Math.sin(angle) * orbitY,
          r: holeRadius
        });
        holesLayer.appendChild(hole);
      }
    }

    function renderCutout(box, currentValues) {
      cutoutLayer.hidden = !state.cutout;
      if (!state.cutout) return;

      var maximumSize = Math.max(1, Math.min(currentValues.width, currentValues.height) * 0.7);
      var sizeCm = clamp(num(cutoutSizeInput.value, 3), 1, maximumSize);
      cutoutSizeInput.value = Number(sizeCm.toFixed(1));
      var size = sizeCm * box.scale;

      cutoutCircle.hidden = state.cutoutType !== 'circle';
      cutoutRect.hidden = state.cutoutType !== 'rounded';
      cutoutText.hidden = state.cutoutType !== 'text';

      if (state.cutoutType === 'circle') {
        attrs(cutoutCircle, { cx: 350, cy: 225, r: size / 2 });
      } else if (state.cutoutType === 'rounded') {
        var radiusCm = clamp(num(cutoutRadiusInput.value, 0.5), 0, sizeCm / 2);
        cutoutRadiusInput.value = Number(radiusCm.toFixed(1));
        attrs(cutoutRect, {
          x: 350 - size / 2,
          y: 225 - size / 2,
          width: size,
          height: size,
          rx: radiusCm * box.scale
        });
      } else {
        var text = letters(cutoutTextInput);
        cutoutText.textContent = text;
        attrs(cutoutText, { x: 350, y: 225, 'font-size': size });
      }
    }

    function renderDimensions(box, currentValues) {
      var horizontalY = box.y + box.height + 48;
      var verticalX = box.x - 50;

      setLine('.pc-w-ext-a', box.x, box.y + box.height + 4, box.x, horizontalY + 7);
      setLine('.pc-w-ext-b', box.x + box.width, box.y + box.height + 4, box.x + box.width, horizontalY + 7);
      setLine('.pc-dim-w', box.x, horizontalY, box.x + box.width, horizontalY);
      setDimensionLabel('.pc-label-w', '.pc-label-w-bg', 350, horizontalY, measure(currentValues.width) + ' cm');

      setLine('.pc-h-ext-a', box.x - 4, box.y, verticalX - 7, box.y);
      setLine('.pc-h-ext-b', box.x - 4, box.y + box.height, verticalX - 7, box.y + box.height);
      setLine('.pc-dim-h', verticalX, box.y, verticalX, box.y + box.height);
      setDimensionLabel('.pc-label-h', '.pc-label-h-bg', verticalX, 225, measure(currentValues.height) + ' cm');
    }

    function shapeLabel(currentValues) {
      if (state.shape === 'circle') return 'Cirkel · Ø ' + measure(currentValues.width) + ' cm';
      if (state.shape === 'rounded') return 'Vierkant met radius · ' + measure(currentValues.width) + ' × ' + measure(currentValues.height) + ' cm';
      if (state.shape === 'letter') return 'Letters “' + currentValues.text + '” · ' + measure(currentValues.height) + ' cm hoog';
      return 'Rechthoek · ' + measure(currentValues.width) + ' × ' + measure(currentValues.height) + ' cm';
    }

    function price(currentValues) {
      var areaPart = currentValues.width * currentValues.height / (305 * 155);
      var thicknessPart = 0.82 + state.thickness * 0.09;
      var shapePart = state.shape === 'rectangle' ? 1 : state.shape === 'rounded' ? 1.08 : 1.12;
      var extras = (state.holes ? clamp(Math.round(num(holeCountInput.value, 4)), 1, 12) * 65 : 0) +
        (state.cutout ? 425 : 0) +
        (state.finish === 'gefreesd' ? 550 : 0);
      return Math.max(basePrice, Math.round((basePrice + areaPart * 6100) * thicknessPart * shapePart + extras));
    }

    function updateSummary(currentValues, unitPrice) {
      var dimensionsText = state.shape === 'circle'
        ? 'Ø ' + measure(currentValues.width) + ' cm'
        : state.shape === 'letter'
          ? currentValues.text + ' · ' + measure(currentValues.height) + ' cm hoog'
          : measure(currentValues.width) + ' × ' + measure(currentValues.height) + ' cm';

      var holeCount = clamp(Math.round(num(holeCountInput.value, 4)), 1, 12);
      var holeDiameter = clamp(num(holeDiameterInput.value, 8), 3, 50);
      var compact = dimensionsText + ' · ' + state.thickness + ' mm' +
        (state.holes ? ' · ' + holeCount + ' gaten Ø ' + measure(holeDiameter) + ' mm' : '') +
        (state.cutout ? ' · uitsnede' : '');

      var shapeSummary = one('[data-pc-shape-summary]');
      var thicknessSummary = one('[data-pc-thickness-summary]');
      var holesSummary = one('[data-pc-holes-summary]');
      var cutoutSummary = one('[data-pc-cutout-summary]');
      var finishSummary = one('[data-pc-finish-summary]');

      if (shapeSummary) shapeSummary.textContent = shapeLabel(currentValues);
      if (thicknessSummary) thicknessSummary.textContent = state.thickness + ' mm';
      if (holesSummary) holesSummary.textContent = state.holes ? holeCount + ' st. · Ø ' + measure(holeDiameter) + ' mm' : 'Geen';
      if (cutoutSummary) cutoutSummary.textContent = state.cutout
        ? ({ circle: 'Rond', rounded: 'Vierkant + radius', text: 'Letters' }[state.cutoutType])
        : 'Geen';
      if (finishSummary) finishSummary.textContent = state.finish === 'gefreesd' ? 'Gefreesd' : 'Gezaagd';

      all('[data-pc-summary]').forEach(function (element) { element.textContent = compact; });
      all('[data-pc-price]').forEach(function (element) {
        element.textContent = money(unitPrice * state.quantity, root.dataset.locale, root.dataset.currency);
      });

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
      updateFieldVisibility();
      renderView();

      var currentValues = values();
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
      updateSummary(currentValues, price(currentValues));
    }

    function chooseShape(shape) {
      state.shape = shape;
      state.mainMode = shape === 'rectangle' ? 'rectangle' : 'picker';
      state.view = 'dimensions';
      if (shape === 'circle') {
        var diameter = clamp(num(widthInput.value, 10), 1, Math.min(maximumWidth, maximumHeight));
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
          all('[data-pc-main-shape]').forEach(function (item) {
            item.setAttribute('aria-selected', String(item.dataset.pcMainShape === 'upload'));
          });
          uploadInput.click();
        }
      });
    });

    all('[data-pc-shape]').forEach(function (button) {
      button.addEventListener('click', function () { chooseShape(button.dataset.pcShape); });
    });

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
    holeCountInput.addEventListener('input', function () { state.view = 'dimensions'; render(); });
    holeDiameterInput.addEventListener('input', function () { state.view = 'dimensions'; render(); });

    cutoutToggle.addEventListener('change', function () {
      state.cutout = cutoutToggle.checked;
      one('[data-pc-cutout-fields]').hidden = !state.cutout;
      state.view = 'dimensions';
      render();
    });

    all('[data-pc-cutout-type]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.cutoutType = button.dataset.pcCutoutType;
        all('[data-pc-cutout-type]').forEach(function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        one('[data-pc-cutout-radius-field]').hidden = state.cutoutType !== 'rounded';
        one('[data-pc-cutout-text-field]').hidden = state.cutoutType !== 'text';
        one('[data-pc-cutout-size-field]').hidden = false;
        state.view = 'dimensions';
        render();
      });
    });

    [cutoutSizeInput, cutoutRadiusInput, cutoutTextInput].forEach(function (input) {
      input.addEventListener('input', function () { state.view = 'dimensions'; render(); });
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
