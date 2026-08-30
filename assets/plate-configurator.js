(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function numberValue(value, fallback) {
    var parsed = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatMeasure(value) {
    return Number(value.toFixed(1)).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  }

  function formatMoney(cents, locale, currency) {
    return new Intl.NumberFormat(locale || 'nl-NL', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(cents / 100);
  }

  function setAttributes(element, attributes) {
    Object.keys(attributes).forEach(function (name) {
      element.setAttribute(name, attributes[name]);
    });
  }

  function init(root) {
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    var query = function (selector) { return root.querySelector(selector); };
    var queryAll = function (selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); };

    var widthInput = query('[data-pc-width]');
    var heightInput = query('[data-pc-height]');
    var thicknessInput = query('[data-pc-thickness]');
    var holesToggle = query('[data-pc-holes]');
    var holeCountInput = query('[data-pc-holes-count]');
    var holeDiameterInput = query('[data-pc-hole-dia]');
    var cutoutToggle = query('[data-pc-cutout]');
    var uploadInput = query('[data-pc-upload]');
    var shapePicker = query('[data-pc-shape-picker]');
    var canvas = query('.pc-canvas');
    var svg = query('.pc-svg');
    var image = query('.pc-image');
    var shape = query('.pc-shape');
    var cutout = query('.pc-cutout');
    var holesGroup = query('.pc-holes');

    if (!widthInput || !heightInput || !svg || !shape) return;

    var maxWidth = numberValue(root.dataset.maxWidth, 305);
    var maxHeight = numberValue(root.dataset.maxHeight, 155);
    var basePrice = Math.max(1, numberValue(root.dataset.basePrice, 1295));

    var state = {
      shape: 'rectangle',
      view: 'dimensions',
      thickness: 2,
      holes: false,
      cutout: false,
      finish: 'gezaagd',
      quantity: 1,
      uploadedImage: false
    };

    var toastTimer;

    function showToast(message) {
      var toast = query('[data-pc-toast]');
      if (!toast) return;
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.hidden = false;
      toastTimer = window.setTimeout(function () { toast.hidden = true; }, 2400);
    }

    function dimensions() {
      var width = clamp(numberValue(widthInput.value, 10), 1, maxWidth);
      var height = clamp(numberValue(heightInput.value, 10), 1, maxHeight);
      if (state.shape === 'circle') {
        var diameter = clamp(width, 1, Math.min(maxWidth, maxHeight));
        width = diameter;
        height = diameter;
      }
      widthInput.value = Number(width.toFixed(1));
      heightInput.value = Number(height.toFixed(1));
      return { width: width, height: height };
    }

    function shapeName() {
      return {
        rectangle: 'Rechthoek',
        rounded: 'Afgeronde rechthoek',
        circle: 'Cirkel',
        triangle: 'Driehoek'
      }[state.shape] || 'Rechthoek';
    }

    function renderView() {
      var imageMode = state.view === 'image';
      svg.hidden = imageMode;
      svg.style.display = imageMode ? 'none' : 'block';
      if (image) {
        image.hidden = !imageMode;
        image.style.display = imageMode ? (image.classList.contains('pc-image--placeholder') ? 'grid' : 'block') : 'none';
      }
      if (canvas) canvas.classList.toggle('is-image', imageMode);
      queryAll('[data-pc-tab]').forEach(function (button) {
        button.setAttribute('aria-selected', String(button.dataset.pcTab === state.view));
      });
    }

    function setLine(selector, x1, y1, x2, y2) {
      var line = query(selector);
      if (!line) return;
      setAttributes(line, { x1: x1, y1: y1, x2: x2, y2: y2 });
    }

    function setLabel(textSelector, backgroundSelector, x, y, text) {
      var label = query(textSelector);
      var background = query(backgroundSelector);
      if (!label || !background) return;
      label.textContent = text;
      setAttributes(label, { x: x, y: y });
      var width = Math.max(60, text.length * 8 + 22);
      setAttributes(background, { x: x - width / 2, y: y - 13, width: width, height: 26 });
    }

    function renderDrawing(box, values) {
      var x = box.x;
      var y = box.y;
      var width = box.width;
      var height = box.height;
      var radius = Math.min(24, width * 0.12, height * 0.12);

      if (state.shape === 'circle') {
        var circleRadius = Math.min(width, height) / 2;
        shape.setAttribute('d',
          'M ' + (360 - circleRadius) + ' 235 ' +
          'a ' + circleRadius + ' ' + circleRadius + ' 0 1 0 ' + (circleRadius * 2) + ' 0 ' +
          'a ' + circleRadius + ' ' + circleRadius + ' 0 1 0 -' + (circleRadius * 2) + ' 0'
        );
      } else if (state.shape === 'rounded') {
        shape.setAttribute('d',
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
      } else if (state.shape === 'triangle') {
        shape.setAttribute('d',
          'M ' + (x + width / 2) + ' ' + y +
          ' L ' + (x + width) + ' ' + (y + height) +
          ' L ' + x + ' ' + (y + height) + ' Z'
        );
      } else {
        shape.setAttribute('d',
          'M ' + x + ' ' + y +
          ' H ' + (x + width) +
          ' V ' + (y + height) +
          ' H ' + x + ' Z'
        );
      }

      var cutoutSize = clamp(Math.min(width, height) * 0.27, 30, 86);
      cutout.hidden = !state.cutout;
      if (state.cutout) {
        setAttributes(cutout, {
          x: 360 - cutoutSize / 2,
          y: 235 - cutoutSize / 2,
          width: cutoutSize,
          height: cutoutSize,
          rx: Math.min(8, cutoutSize * 0.12)
        });
      }

      while (holesGroup.firstChild) holesGroup.removeChild(holesGroup.firstChild);
      if (state.holes) {
        var count = clamp(Math.round(numberValue(holeCountInput.value, 4)), 1, 12);
        var diameterMm = clamp(numberValue(holeDiameterInput.value, 8), 3, 50);
        holeCountInput.value = count;
        holeDiameterInput.value = Number(diameterMm.toFixed(1));
        var holeRadius = clamp((diameterMm / 10) * box.scale / 2, 3.5, 16);
        var orbitX = Math.max(10, width * 0.37);
        var orbitY = Math.max(10, height * 0.34);

        for (var index = 0; index < count; index += 1) {
          var angle = (index / count) * Math.PI * 2 - Math.PI / 2;
          var hole = document.createElementNS(SVG_NS, 'circle');
          hole.setAttribute('class', 'pc-hole');
          setAttributes(hole, {
            cx: 360 + Math.cos(angle) * orbitX,
            cy: 235 + Math.sin(angle) * orbitY,
            r: holeRadius
          });
          holesGroup.appendChild(hole);
        }
      }

      var horizontalY = y + height + 48;
      var verticalX = x - 54;
      setLine('.pc-w-ext-a', x, y + height + 5, x, horizontalY + 8);
      setLine('.pc-w-ext-b', x + width, y + height + 5, x + width, horizontalY + 8);
      setLine('.pc-dim-w', x, horizontalY, x + width, horizontalY);
      setLabel('.pc-label-w', '.pc-label-w-bg', 360, horizontalY + 28, formatMeasure(values.width) + ' cm');

      setLine('.pc-h-ext-a', x - 5, y, verticalX - 8, y);
      setLine('.pc-h-ext-b', x - 5, y + height, verticalX - 8, y + height);
      setLine('.pc-dim-h', verticalX, y, verticalX, y + height);
      setLabel('.pc-label-h', '.pc-label-h-bg', verticalX - 3, 235, formatMeasure(values.height) + ' cm');
    }

    function calculatePrice(values) {
      var areaFactor = (values.width * values.height) / (305 * 155);
      var thicknessFactor = 0.82 + state.thickness * 0.09;
      var shapeFactor = state.shape === 'circle' ? 1.08 : state.shape === 'triangle' ? 1.12 : state.shape === 'rounded' ? 1.06 : 1;
      var extras = (state.holes ? Math.round(numberValue(holeCountInput.value, 4)) * 65 : 0) +
        (state.cutout ? 425 : 0) +
        (state.finish === 'gefreesd' ? 595 : 0);
      return Math.max(basePrice, Math.round((basePrice + areaFactor * 6200) * thicknessFactor * shapeFactor + extras));
    }

    function updateSummaries(values, totalPrice) {
      var measurement = formatMeasure(values.width) + ' × ' + formatMeasure(values.height) + ' cm';
      var dimensionText = state.shape === 'circle'
        ? 'Cirkel · Ø ' + formatMeasure(values.width) + ' cm'
        : shapeName() + ' · ' + measurement;
      var holesCount = state.holes ? clamp(Math.round(numberValue(holeCountInput.value, 4)), 1, 12) : 0;
      var holeDiameter = clamp(numberValue(holeDiameterInput.value, 8), 3, 50);
      var compact = measurement + ' · ' + state.thickness + ' mm' +
        (state.holes ? ' · ' + holesCount + ' gaten Ø ' + formatMeasure(holeDiameter) + ' mm' : '') +
        (state.cutout ? ' · uitsnede' : '');

      var dimensionSummary = query('[data-pc-dimension-summary]');
      var thicknessSummary = query('[data-pc-thickness-summary]');
      var holesSummary = query('[data-pc-holes-summary]');
      var cutoutSummary = query('[data-pc-cutout-summary]');
      var finishSummary = query('[data-pc-finish-summary]');

      if (dimensionSummary) dimensionSummary.textContent = dimensionText;
      if (thicknessSummary) thicknessSummary.textContent = state.thickness + ' mm';
      if (holesSummary) holesSummary.textContent = state.holes ? holesCount + ' stuks · Ø ' + formatMeasure(holeDiameter) + ' mm' : 'Geen boorgaten';
      if (cutoutSummary) cutoutSummary.textContent = state.cutout ? 'Centrale uitsnede' : 'Geen uitsnede';
      if (finishSummary) finishSummary.textContent = state.finish === 'gefreesd' ? 'Glad gefreesd' : 'Gezaagd';

      queryAll('[data-pc-summary]').forEach(function (element) { element.textContent = compact; });
      queryAll('[data-pc-price]').forEach(function (element) {
        element.textContent = formatMoney(totalPrice * state.quantity, root.dataset.locale, root.dataset.currency);
      });

      var holesStatus = query('[data-pc-holes-status]');
      var cutoutStatus = query('[data-pc-cutout-status]');
      if (holesStatus) {
        holesStatus.textContent = state.holes ? '✓' : '3';
        holesStatus.classList.toggle('pc-step-number--done', state.holes);
      }
      if (cutoutStatus) {
        cutoutStatus.textContent = state.cutout ? '✓' : '4';
        cutoutStatus.classList.toggle('pc-step-number--done', state.cutout);
      }
    }

    function render() {
      var values = dimensions();
      var scale = Math.min(430 / values.width, 255 / values.height);
      var renderedWidth = values.width * scale;
      var renderedHeight = values.height * scale;
      var box = {
        x: 360 - renderedWidth / 2,
        y: 235 - renderedHeight / 2,
        width: renderedWidth,
        height: renderedHeight,
        scale: scale
      };

      renderView();
      renderDrawing(box, values);
      updateSummaries(values, calculatePrice(values));
    }

    function selectShape(nextShape, button) {
      state.shape = nextShape;
      if (state.shape === 'circle') {
        var diameter = clamp(numberValue(widthInput.value, 10), 1, Math.min(maxWidth, maxHeight));
        widthInput.value = diameter;
        heightInput.value = diameter;
      }
      queryAll('[data-shape],[data-pc-shape-choice]').forEach(function (item) {
        var itemShape = item.dataset.shape || item.dataset.pcShapeChoice;
        item.setAttribute('aria-pressed', String(itemShape === nextShape));
      });
      var rectangleButton = query('[data-shape="rectangle"]');
      if (rectangleButton) rectangleButton.setAttribute('aria-pressed', String(nextShape === 'rectangle'));
      if (shapePicker) shapePicker.hidden = true;
      var opener = query('[data-pc-open-shapes]');
      if (opener) opener.setAttribute('aria-expanded', 'false');
      state.view = 'dimensions';
      render();
    }

    queryAll('[data-shape]').forEach(function (button) {
      button.addEventListener('click', function () { selectShape(button.dataset.shape, button); });
    });

    var shapeOpener = query('[data-pc-open-shapes]');
    if (shapeOpener && shapePicker) {
      shapeOpener.addEventListener('click', function () {
        shapePicker.hidden = !shapePicker.hidden;
        shapeOpener.setAttribute('aria-expanded', String(!shapePicker.hidden));
      });
    }

    queryAll('[data-pc-shape-choice]').forEach(function (button) {
      button.addEventListener('click', function () { selectShape(button.dataset.pcShapeChoice, button); });
    });

    var uploadTrigger = query('[data-pc-upload-trigger]');
    if (uploadTrigger && uploadInput) {
      uploadTrigger.addEventListener('click', function () { uploadInput.click(); });
      uploadInput.addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          if (image && !image.classList.contains('pc-image--placeholder')) image.src = reader.result;
          state.uploadedImage = true;
          state.view = 'image';
          var note = query('[data-pc-upload-note]');
          if (note) {
            note.textContent = file.name + ' is gekozen en wordt als voorbeeld getoond.';
            note.hidden = false;
          }
          render();
        };
        reader.readAsDataURL(file);
      });
    }

    queryAll('[data-pc-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.view = button.dataset.pcTab;
        render();
      });
    });

    widthInput.addEventListener('input', function () {
      if (state.shape === 'circle') heightInput.value = widthInput.value;
      state.view = 'dimensions';
      render();
    });
    heightInput.addEventListener('input', function () {
      if (state.shape === 'circle') widthInput.value = heightInput.value;
      state.view = 'dimensions';
      render();
    });

    queryAll('[data-pc-thickness-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.thickness = numberValue(button.dataset.pcThicknessChoice, 2);
        thicknessInput.value = state.thickness;
        queryAll('[data-pc-thickness-choice]').forEach(function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        render();
      });
    });

    holesToggle.addEventListener('change', function () {
      state.holes = holesToggle.checked;
      var extra = query('[data-pc-holes-extra]');
      if (extra) extra.hidden = !state.holes;
      state.view = 'dimensions';
      render();
    });
    holeCountInput.addEventListener('input', function () { state.view = 'dimensions'; render(); });
    holeDiameterInput.addEventListener('input', function () { state.view = 'dimensions'; render(); });

    cutoutToggle.addEventListener('change', function () {
      state.cutout = cutoutToggle.checked;
      state.view = 'dimensions';
      render();
    });

    queryAll('[data-finish]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.finish = button.dataset.finish;
        queryAll('[data-finish]').forEach(function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        render();
      });
    });

    queryAll('.pc-accord').forEach(function (details) {
      details.addEventListener('toggle', function () {
        if (!details.open) return;
        queryAll('.pc-accord').forEach(function (other) {
          if (other !== details) other.open = false;
        });
      });
    });

    var quantityLabel = query('[data-pc-quantity]');
    function setQuantity(next) {
      state.quantity = clamp(next, 1, 99);
      if (quantityLabel) quantityLabel.textContent = state.quantity;
      render();
    }
    var minus = query('[data-pc-qty-minus]');
    var plus = query('[data-pc-qty-plus]');
    if (minus) minus.addEventListener('click', function () { setQuantity(state.quantity - 1); });
    if (plus) plus.addEventListener('click', function () { setQuantity(state.quantity + 1); });

    queryAll('[data-pc-cart]').forEach(function (button) {
      button.addEventListener('click', function () {
        showToast('Concept: ' + state.quantity + ' geconfigureerde plaat' + (state.quantity === 1 ? '' : 'en') + ' klaar voor de winkelmand.');
      });
    });

    var sample = query('[data-pc-sample]');
    if (sample) sample.addEventListener('click', function () {
      showToast('Sample-aanvraag geopend — in deze conceptversie wordt nog niets besteld.');
    });

    render();
  }

  function boot(scope) {
    (scope || document).querySelectorAll('[data-plate-configurator]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (event) { boot(event.target); });
}());
