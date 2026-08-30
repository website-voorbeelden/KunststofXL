(function () {
  "use strict";

  if (window.__rtProductUiLiteLoaded) return;
  window.__rtProductUiLiteLoaded = true;

  const ROOT_SEL =
    "[data-rt-product-ui]," +
    "[data-rt-price-wrap]," +
    "[data-rt-discount-table-wrap]";

  const FORM_SEL = 'form[action*="/cart/add"], form[action^="/cart/add"]';

  const roots = new Set();
  let rafAll = 0;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function unique(list) {
    return Array.from(new Set((list || []).filter(Boolean)));
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    if (el.closest("[hidden], [aria-hidden='true']")) return false;

    try {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
    } catch (e) {}

    return true;
  }

  function pickVisible(list) {
    const items = unique(list);
    for (let i = 0; i < items.length; i++) {
      if (isVisible(items[i])) return items[i];
    }
    return items[0] || null;
  }

  function parseJSONScript(scope, selector, fallback) {
    try {
      const el = scope.querySelector(selector);
      if (!el) return fallback;
      let parsed = JSON.parse(el.textContent || "");
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch (e) {
      return fallback;
    }
  }

  function normalizeDiscount(v) {
    let n = Number(v);
    if (!Number.isFinite(n)) return 0;
    if (n > 1) n = n / 100;
    if (n < 0) n = 0;
    if (n > 0.99) n = 0.99;
    return n;
  }

  function formatMoneyCents(cents, moneyFormat, localeISO, currencyISO) {
    const c = Math.round(Number(cents) || 0);

    if (window.Shopify && typeof window.Shopify.formatMoney === "function" && moneyFormat) {
      return window.Shopify.formatMoney(c, moneyFormat);
    }

    try {
      return new Intl.NumberFormat(localeISO || undefined, {
        style: "currency",
        currency: currencyISO || "EUR",
      }).format(c / 100);
    } catch (e) {
      return "€" + (c / 100).toFixed(2).replace(".", ",");
    }
  }

  function findScope(root) {
    return (
      root.closest("product-info") ||
      root.closest('[data-section-type="main-product"]') ||
      root.closest(".shopify-section") ||
      root.closest("section") ||
      root.closest("main") ||
      document
    );
  }

  function findScopedForm(root) {
    if (!root) return null;

    const direct = root.closest(FORM_SEL);
    if (direct) return direct;

    const scope = findScope(root);
    const scopedForms = Array.from(scope.querySelectorAll(FORM_SEL));
    const visibleScoped = scopedForms.filter(isVisible);
    if (visibleScoped.length) return visibleScoped[0];
    if (scopedForms.length) return scopedForms[0];

    const allForms = Array.from(document.querySelectorAll(FORM_SEL));
    const visibleAll = allForms.filter(isVisible);
    return visibleAll[0] || allForms[0] || null;
  }

  function getQtyInputScoped(root) {
    const form = findScopedForm(root);
    const scope = form || findScope(root);

    return pickVisible([
      ...scope.querySelectorAll("quantity-selector-component input[name='quantity']"),
      ...scope.querySelectorAll("input[name='quantity']"),
      ...scope.querySelectorAll("quantity-input input"),
    ]);
  }

  function getQtyScoped(root) {
    const el = getQtyInputScoped(root);
    const q = Number(el && el.value);
    return Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
  }

  function getOfficialVariantIdFromRoot(root) {
    const fromEvent = Number(root && root.__rtActiveVariantId);
    if (Number.isFinite(fromEvent) && fromEvent > 0) return fromEvent;
    return null;
  }

  function getVariantIdScoped(root) {
    const fromOfficialEvent = getOfficialVariantIdFromRoot(root);
    if (Number.isFinite(fromOfficialEvent) && fromOfficialEvent > 0) return fromOfficialEvent;

    const form = findScopedForm(root);
    const hiddenId = form ? form.querySelector('input[name="id"]') : null;
    const fromHidden = Number(hiddenId && hiddenId.value);
    if (Number.isFinite(fromHidden) && fromHidden > 0) return fromHidden;

    const scope = form || findScope(root);

    const checkedRadio = pickVisible([
      ...scope.querySelectorAll('input[type="radio"][data-variant-id]:checked')
    ]);
    const fromCheckedRadio = Number(checkedRadio && checkedRadio.getAttribute("data-variant-id"));
    if (Number.isFinite(fromCheckedRadio) && fromCheckedRadio > 0) return fromCheckedRadio;

    const currentChecked = Array.from(
      scope.querySelectorAll('input[type="radio"][data-variant-id]')
    ).find(function (el) {
      return el.getAttribute("data-current-checked") === "true";
    });
    const fromCurrentChecked = Number(currentChecked && currentChecked.getAttribute("data-variant-id"));
    if (Number.isFinite(fromCurrentChecked) && fromCurrentChecked > 0) return fromCurrentChecked;

    const qtyComp = pickVisible(Array.from(scope.querySelectorAll("quantity-selector-component[data-variant-id]")));
    const fromQtyComp = Number(qtyComp && qtyComp.getAttribute("data-variant-id"));
    if (Number.isFinite(fromQtyComp) && fromQtyComp > 0) return fromQtyComp;

    const fromUrl = Number(new URLSearchParams(window.location.search).get("variant"));
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;

    return null;
  }

  function syncQuantityComponentState(root, inputEl, qtyValue) {
    const comp = inputEl && inputEl.closest("quantity-selector-component");
    if (!comp) return;

    const min = Number(inputEl.getAttribute("min") || inputEl.getAttribute("data-min") || 1) || 1;
    const minusBtn = comp.querySelector('button[name="minus"]');
    const plusBtn = comp.querySelector('button[name="plus"]');

    if (minusBtn) minusBtn.disabled = qtyValue <= min;
    if (plusBtn) plusBtn.disabled = false;

    const variantId = getVariantIdScoped(root);
    if (variantId) comp.setAttribute("data-variant-id", String(variantId));
  }

  function setQtyScoped(root, n) {
    const el = getQtyInputScoped(root);
    if (!el) return;

    const nextNum = Math.max(1, Math.floor(Number(n) || 1));
    const next = String(nextNum);

    if (el.value !== next) {
      el.value = next;
      el.setAttribute("value", next);
    }

    syncQuantityComponentState(root, el, nextNum);

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function buildCtx(root) {
    const settings = {
      vatRate: Number(root.getAttribute("data-rt-vat-rate") || "0.21"),
      priceIncludesVat: root.getAttribute("data-rt-price-includes-vat") !== "false",
      hideBaseUnitCentsLte: Number(root.getAttribute("data-rt-hide-base-unit-cents-lte") || "1"),
      moneyFormat: root.getAttribute("data-rt-money-format") || "",
      localeISO: root.getAttribute("data-rt-locale") || document.documentElement.lang || "",
      currencyISO: root.getAttribute("data-rt-currency") || "EUR",
    };

    const tiersRaw =
      parseJSONScript(root, 'script[data-rt-product-tiers]', null) ||
      parseJSONScript(root, 'script[data-rt-price-tiers]', null) ||
      parseJSONScript(root, 'script[data-rt-volume-tiers]', { tiers: [] });

    const variantPricesRaw =
      parseJSONScript(root, 'script[data-rt-product-variant-prices]', null) ||
      parseJSONScript(root, 'script[data-rt-price-variant-prices]', null) ||
      parseJSONScript(root, 'script[data-rt-variant-prices]', []);

    const tiers = (Array.isArray(tiersRaw && tiersRaw.tiers) ? tiersRaw.tiers : [])
      .map(function (t) {
        return { min: Number(t.min), discount: normalizeDiscount(t.discount) };
      })
      .filter(function (t) {
        return Number.isFinite(t.min) && t.min >= 2 && t.discount > 0;
      })
      .sort(function (a, b) {
        return a.min - b.min;
      });

    const priceMap = new Map(
      (Array.isArray(variantPricesRaw) ? variantPricesRaw : []).map(function (p) {
        return [Number(p.id), Number(p.price)];
      })
    );

    function discountForQty(qty) {
      let d = 0;
      for (let i = 0; i < tiers.length; i++) {
        if (qty >= tiers[i].min) d = tiers[i].discount;
      }
      return d;
    }

    function getState() {
      const variantId = getVariantIdScoped(root);
      const qty = getQtyScoped(root);

      if (!variantId) {
        return { ok: false, variantId: null, qty: qty, baseCentsRaw: null };
      }

      const baseCentsRaw = priceMap.get(variantId);
      if (!Number.isFinite(baseCentsRaw)) {
        return { ok: false, variantId: variantId, qty: qty, baseCentsRaw: null };
      }

      const discount = discountForQty(qty);
      const baseUnitIncl = settings.priceIncludesVat
        ? baseCentsRaw
        : Math.round(baseCentsRaw * (1 + settings.vatRate));

      const unitIncl = Math.round(baseUnitIncl * (1 - discount));
      const totalIncl = unitIncl * qty;
      const totalExcl = Math.round(totalIncl / (1 + settings.vatRate));
      const savings = baseUnitIncl * qty - totalIncl;

      return {
        ok: true,
        variantId: variantId,
        qty: qty,
        discount: discount,
        baseCentsRaw: baseCentsRaw,
        baseUnitIncl: baseUnitIncl,
        totalIncl: totalIncl,
        totalExcl: totalExcl,
        savings: savings,
      };
    }

    return {
      root: root,
      settings: settings,
      tiers: tiers,
      priceMap: priceMap,
      getState: getState,
      getQty: function () {
        return getQtyScoped(root);
      },
      setQty: function (n) {
        return setQtyScoped(root, n);
      },
      tableBuiltForVariantId: null,
    };
  }

  function renderPriceBox(ctx, state) {
    const box =
      ctx.root.querySelector("[data-rt-price-box]") ||
      ctx.root.querySelector("[data-rt-dynamic-price]");

    if (!box) return;

    const exclEl =
      box.querySelector("[data-rt-price-excl]") ||
      box.querySelector("[data-rt-excl]");

    const inclEl =
      box.querySelector("[data-rt-price-incl]") ||
      box.querySelector("[data-rt-incl]");

    const saveEl =
      box.querySelector("[data-rt-price-save]") ||
      box.querySelector("[data-rt-save]");

    if (!state.ok || state.baseCentsRaw <= ctx.settings.hideBaseUnitCentsLte) {
      box.hidden = true;
      if (exclEl) exclEl.textContent = "";
      if (inclEl) inclEl.textContent = "";
      if (saveEl) saveEl.textContent = "";
      return;
    }

    box.hidden = false;

    if (exclEl) {
      exclEl.textContent =
        formatMoneyCents(
          state.totalExcl,
          ctx.settings.moneyFormat,
          ctx.settings.localeISO,
          ctx.settings.currencyISO
        ) + " (excl. BTW)";
    }

    if (inclEl) {
      inclEl.textContent =
        formatMoneyCents(
          state.totalIncl,
          ctx.settings.moneyFormat,
          ctx.settings.localeISO,
          ctx.settings.currencyISO
        ) + " (incl. BTW)";
    }

    if (saveEl) {
      saveEl.textContent =
        state.discount > 0
          ? "- " +
            formatMoneyCents(
              state.savings,
              ctx.settings.moneyFormat,
              ctx.settings.localeISO,
              ctx.settings.currencyISO
            )
          : "";
    }
  }

  function buildDiscountTableHTML(ctx, state) {
    const vatRate = ctx.settings.vatRate;
    const unitIncl = state.baseUnitIncl;
    const baseUnitExcl = Math.round(unitIncl / (1 + vatRate));

    let html = "";
    html += '<table class="discount-table" data-rt-table>';
    html += "<thead><tr>";
    html += '<th>Aantal<br><span class="subtext">stuks</span></th>';
    html += '<th>Prijs<br><span class="subtext">excl. BTW</span></th>';
    html += '<th>Prijs<br><span class="subtext">incl. BTW</span></th>';
    html += "<th>Korting</th>";
    html += "</tr></thead><tbody>";

    html +=
      '<tr data-min-qty="1">' +
      "<td>1</td>" +
      "<td>" + formatMoneyCents(baseUnitExcl, ctx.settings.moneyFormat, ctx.settings.localeISO, ctx.settings.currencyISO) + "</td>" +
      "<td>" + formatMoneyCents(unitIncl, ctx.settings.moneyFormat, ctx.settings.localeISO, ctx.settings.currencyISO) + "</td>" +
      "<td>-</td>" +
      "</tr>";

    for (let i = 0; i < ctx.tiers.length; i++) {
      const t = ctx.tiers[i];
      const tierUnitIncl = Math.round(unitIncl * (1 - t.discount));
      const tierUnitExcl = Math.round(tierUnitIncl / (1 + vatRate));
      const pct = Math.round(t.discount * 100);

      html +=
        '<tr data-min-qty="' + t.min + '">' +
        "<td>" + t.min + "+</td>" +
        "<td>" + formatMoneyCents(tierUnitExcl, ctx.settings.moneyFormat, ctx.settings.localeISO, ctx.settings.currencyISO) + "</td>" +
        "<td>" + formatMoneyCents(tierUnitIncl, ctx.settings.moneyFormat, ctx.settings.localeISO, ctx.settings.currencyISO) + "</td>" +
        '<td class="korting">' + pct + "%</td>" +
        "</tr>";
    }

    html += "</tbody></table>";
    return html;
  }

  function applyActiveTier(ctx) {
    const out = ctx.root.querySelector("[data-rt-discount-table]");
    const table = out && out.querySelector("[data-rt-table]");
    if (!table) return;

    const qty = ctx.getQty();
    let activeMin = 1;

    for (let i = 0; i < ctx.tiers.length; i++) {
      if (qty >= ctx.tiers[i].min) activeMin = ctx.tiers[i].min;
    }

    table.querySelectorAll("tr[data-min-qty]").forEach(function (tr) {
      tr.classList.toggle("active-tier", Number(tr.getAttribute("data-min-qty")) === activeMin);
    });
  }

  function renderDiscountTable(ctx, state) {
    const wrap =
      ctx.root.querySelector("[data-rt-discount-wrap]") ||
      ctx.root.querySelector("[data-rt-discount-table-wrap]");

    const out = ctx.root.querySelector("[data-rt-discount-table]");
    if (!wrap || !out) return;

    if (!ctx.tiers.length || !state.ok || state.baseCentsRaw <= ctx.settings.hideBaseUnitCentsLte) {
      wrap.hidden = true;
      out.innerHTML = "";
      ctx.tableBuiltForVariantId = null;
      return;
    }

    wrap.hidden = false;

    if (ctx.tableBuiltForVariantId !== state.variantId || !out.querySelector("[data-rt-table]")) {
      out.innerHTML = buildDiscountTableHTML(ctx, state);
      ctx.tableBuiltForVariantId = state.variantId;
    }

    applyActiveTier(ctx);

    if (!out.dataset.rtBound) {
      out.dataset.rtBound = "1";
      out.addEventListener("click", function (e) {
        const tr = e.target.closest("tr[data-min-qty]");
        if (!tr) return;

        const min = Number(tr.getAttribute("data-min-qty"));
        if (!Number.isFinite(min) || min < 1) return;

        ctx.setQty(min);
        scheduleAll(false);
      });
    }
  }

  function updateRoot(root) {
    if (!root || !root.__rtCtx) return;
    const ctx = root.__rtCtx;
    const state = ctx.getState();

    renderPriceBox(ctx, state);
    renderDiscountTable(ctx, state);
  }

  function updateRoots(list) {
    unique(list).forEach(function (root) {
      if (root && root.__rtCtx) updateRoot(root);
    });
  }

  function scheduleAll(useDoubleRaf) {
    if (rafAll) cancelAnimationFrame(rafAll);

    rafAll = requestAnimationFrame(function () {
      rafAll = 0;

      if (useDoubleRaf) {
        requestAnimationFrame(function () {
          roots.forEach(function (root) {
            updateRoot(root);
          });
        });
      } else {
        roots.forEach(function (root) {
          updateRoot(root);
        });
      }
    });
  }

  function initRoot(root) {
    if (!root || root.dataset.rtProductUiInited === "1") return;
    root.dataset.rtProductUiInited = "1";
    root.__rtActiveVariantId = null;
    root.__rtCtx = buildCtx(root);
    roots.add(root);
    updateRoot(root);
  }

  function initRootsIn(scope) {
    const base = scope && scope.querySelectorAll ? scope : document;
    base.querySelectorAll(ROOT_SEL).forEach(initRoot);
  }

  function initAll() {
    initRootsIn(document);
    scheduleAll(false);
  }

  function findEventScope(eventTarget) {
    if (!eventTarget || !(eventTarget instanceof Element)) return document;

    return (
      eventTarget.closest(".shopify-section, dialog, product-card") ||
      eventTarget.closest(".shopify-section") ||
      eventTarget.closest("dialog") ||
      eventTarget.closest("product-card") ||
      document
    );
  }

  function shouldHandleQuantityEvent(target) {
    return !!(
      target &&
      (
        target.matches("quantity-selector-component input[name='quantity']") ||
        target.matches("input[name='quantity']") ||
        target.matches("quantity-input input")
      )
    );
  }

  function shouldHandleVariantChange(target) {
    return !!(
      target &&
      (
        target.matches('input[name="id"]') ||
        target.matches("select") ||
        target.matches('input[type="radio"]')
      )
    );
  }

  function shouldHandleVariantClick(target) {
    return !!(
      target &&
      (
        target.closest("label.variant-option__button-label") ||
        target.closest("[data-option-value]") ||
        target.closest("variant-selects") ||
        target.closest("variant-radios")
      )
    );
  }

  function shouldHandleQtyButtonClick(target) {
    return !!(
      target &&
      (
        target.closest('quantity-selector-component button[name="plus"]') ||
        target.closest('quantity-selector-component button[name="minus"]')
      )
    );
  }

  if (!window.__rtProductUiLiteEventsBound) {
    window.__rtProductUiLiteEventsBound = true;

    document.addEventListener(
      "variant:update",
      function (e) {
        const variantId = Number(e && e.detail && e.detail.resource && e.detail.resource.id);
        const scope = findEventScope(e.target);

        initRootsIn(scope);

        const targetRoots = Array.from(scope.querySelectorAll(ROOT_SEL));
        const rootsToUpdate = targetRoots.length ? targetRoots : Array.from(roots);

        rootsToUpdate.forEach(function (root) {
          root.__rtActiveVariantId =
            Number.isFinite(variantId) && variantId > 0 ? variantId : null;

          if (root.__rtCtx) {
            root.__rtCtx.tableBuiltForVariantId = null;
          }
        });

        requestAnimationFrame(function () {
          updateRoots(rootsToUpdate);
        });
      },
      true
    );

    document.addEventListener(
      "input",
      function (e) {
        if (shouldHandleQuantityEvent(e.target)) {
          scheduleAll(false);
        }
      },
      true
    );

    document.addEventListener(
      "change",
      function (e) {
        if (shouldHandleQuantityEvent(e.target)) {
          scheduleAll(false);
          return;
        }

        if (shouldHandleVariantChange(e.target)) {
          scheduleAll(false);
        }
      },
      true
    );

    document.addEventListener(
      "click",
      function (e) {
        if (shouldHandleQtyButtonClick(e.target)) {
          scheduleAll(false);
          return;
        }

        if (shouldHandleVariantClick(e.target)) {
          scheduleAll(false);
        }
      },
      true
    );

    document.addEventListener("shopify:section:load", function (e) {
      initRootsIn((e && e.target) || document);
    });
  }

  onReady(initAll);
})();