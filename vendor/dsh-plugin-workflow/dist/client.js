window.__ModuleLoader__.load({id:'dsh-plugin-workflow',factory:require=>{const module={exports:{}};const exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.development.js
var require_use_sync_external_store_shim_development = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.development.js"(exports) {
    "use strict";
    (function() {
      function is(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      function useSyncExternalStore$2(subscribe, getSnapshot) {
        didWarnOld18Alpha || void 0 === React8.startTransition || (didWarnOld18Alpha = true, console.error(
          "You are using an outdated, pre-release alpha of React 18 that does not support useSyncExternalStore. The use-sync-external-store shim will not work correctly. Upgrade to a newer pre-release."
        ));
        var value = getSnapshot();
        if (!didWarnUncachedGetSnapshot) {
          var cachedValue = getSnapshot();
          objectIs(value, cachedValue) || (console.error(
            "The result of getSnapshot should be cached to avoid an infinite loop"
          ), didWarnUncachedGetSnapshot = true);
        }
        cachedValue = useState8({
          inst: { value, getSnapshot }
        });
        var inst = cachedValue[0].inst, forceUpdate = cachedValue[1];
        useLayoutEffect3(
          function() {
            inst.value = value;
            inst.getSnapshot = getSnapshot;
            checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          },
          [subscribe, value, getSnapshot]
        );
        useEffect6(
          function() {
            checkIfSnapshotChanged(inst) && forceUpdate({ inst });
            return subscribe(function() {
              checkIfSnapshotChanged(inst) && forceUpdate({ inst });
            });
          },
          [subscribe]
        );
        useDebugValue2(value);
        return value;
      }
      function checkIfSnapshotChanged(inst) {
        var latestGetSnapshot = inst.getSnapshot;
        inst = inst.value;
        try {
          var nextValue = latestGetSnapshot();
          return !objectIs(inst, nextValue);
        } catch (error) {
          return true;
        }
      }
      function useSyncExternalStore$1(subscribe, getSnapshot) {
        return getSnapshot();
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var React8 = require("react"), objectIs = "function" === typeof Object.is ? Object.is : is, useState8 = React8.useState, useEffect6 = React8.useEffect, useLayoutEffect3 = React8.useLayoutEffect, useDebugValue2 = React8.useDebugValue, didWarnOld18Alpha = false, didWarnUncachedGetSnapshot = false, shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
      exports.useSyncExternalStore = void 0 !== React8.useSyncExternalStore ? React8.useSyncExternalStore : shim;
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/use-sync-external-store/shim/index.js
var require_shim = __commonJS({
  "node_modules/use-sync-external-store/shim/index.js"(exports, module2) {
    "use strict";
    if (false) {
      module2.exports = null;
    } else {
      module2.exports = require_use_sync_external_store_shim_development();
    }
  }
});

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js
var require_with_selector_development = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js"(exports) {
    "use strict";
    (function() {
      function is(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var React8 = require("react"), shim = require_shim(), objectIs = "function" === typeof Object.is ? Object.is : is, useSyncExternalStore2 = shim.useSyncExternalStore, useRef4 = React8.useRef, useEffect6 = React8.useEffect, useMemo3 = React8.useMemo, useDebugValue2 = React8.useDebugValue;
      exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
        var instRef = useRef4(null);
        if (null === instRef.current) {
          var inst = { hasValue: false, value: null };
          instRef.current = inst;
        } else inst = instRef.current;
        instRef = useMemo3(
          function() {
            function memoizedSelector(nextSnapshot) {
              if (!hasMemo) {
                hasMemo = true;
                memoizedSnapshot = nextSnapshot;
                nextSnapshot = selector(nextSnapshot);
                if (void 0 !== isEqual && inst.hasValue) {
                  var currentSelection = inst.value;
                  if (isEqual(currentSelection, nextSnapshot))
                    return memoizedSelection = currentSelection;
                }
                return memoizedSelection = nextSnapshot;
              }
              currentSelection = memoizedSelection;
              if (objectIs(memoizedSnapshot, nextSnapshot))
                return currentSelection;
              var nextSelection = selector(nextSnapshot);
              if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
                return memoizedSnapshot = nextSnapshot, currentSelection;
              memoizedSnapshot = nextSnapshot;
              return memoizedSelection = nextSelection;
            }
            var hasMemo = false, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
            return [
              function() {
                return memoizedSelector(getSnapshot());
              },
              null === maybeGetServerSnapshot ? void 0 : function() {
                return memoizedSelector(maybeGetServerSnapshot());
              }
            ];
          },
          [getSnapshot, getServerSnapshot, selector, isEqual]
        );
        var value = useSyncExternalStore2(subscribe, instRef[0], instRef[1]);
        useEffect6(
          function() {
            inst.hasValue = true;
            inst.value = value;
          },
          [value]
        );
        useDebugValue2(value);
        return value;
      };
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = __commonJS({
  "node_modules/use-sync-external-store/shim/with-selector.js"(exports, module2) {
    "use strict";
    if (false) {
      module2.exports = null;
    } else {
      module2.exports = require_with_selector_development();
    }
  }
});

// client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// client/step-outline.jsx
var import_react3 = __toESM(require("react"), 1);

// node_modules/lucide-react/dist/esm/createLucideIcon.js
var import_react2 = require("react");

// node_modules/lucide-react/dist/esm/shared/src/utils.js
var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
var mergeClasses = (...classes) => classes.filter((className, index2, array2) => {
  return Boolean(className) && className.trim() !== "" && array2.indexOf(className) === index2;
}).join(" ").trim();

// node_modules/lucide-react/dist/esm/Icon.js
var import_react = require("react");

// node_modules/lucide-react/dist/esm/defaultAttributes.js
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

// node_modules/lucide-react/dist/esm/Icon.js
var Icon = (0, import_react.forwardRef)(
  ({
    color: color2 = "currentColor",
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    className = "",
    children: children2,
    iconNode,
    ...rest
  }, ref) => {
    return (0, import_react.createElement)(
      "svg",
      {
        ref,
        ...defaultAttributes,
        width: size,
        height: size,
        stroke: color2,
        strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
        className: mergeClasses("lucide", className),
        ...rest
      },
      [
        ...iconNode.map(([tag, attrs]) => (0, import_react.createElement)(tag, attrs)),
        ...Array.isArray(children2) ? children2 : [children2]
      ]
    );
  }
);

// node_modules/lucide-react/dist/esm/createLucideIcon.js
var createLucideIcon = (iconName, iconNode) => {
  const Component = (0, import_react2.forwardRef)(
    ({ className, ...props }, ref) => (0, import_react2.createElement)(Icon, {
      ref,
      iconNode,
      className: mergeClasses(`lucide-${toKebabCase(iconName)}`, className),
      ...props
    })
  );
  Component.displayName = `${iconName}`;
  return Component;
};

// node_modules/lucide-react/dist/esm/icons/archive-restore.js
var ArchiveRestore = createLucideIcon("ArchiveRestore", [
  ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1", key: "1wp1u1" }],
  ["path", { d: "M4 8v11a2 2 0 0 0 2 2h2", key: "tvwodi" }],
  ["path", { d: "M20 8v11a2 2 0 0 1-2 2h-2", key: "1gkqxj" }],
  ["path", { d: "m9 15 3-3 3 3", key: "1pd0qc" }],
  ["path", { d: "M12 12v9", key: "192myk" }]
]);

// node_modules/lucide-react/dist/esm/icons/archive.js
var Archive = createLucideIcon("Archive", [
  ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1", key: "1wp1u1" }],
  ["path", { d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8", key: "1s80jp" }],
  ["path", { d: "M10 12h4", key: "a56b0p" }]
]);

// node_modules/lucide-react/dist/esm/icons/arrow-left.js
var ArrowLeft = createLucideIcon("ArrowLeft", [
  ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
  ["path", { d: "M19 12H5", key: "x3x0zl" }]
]);

// node_modules/lucide-react/dist/esm/icons/book-open.js
var BookOpen = createLucideIcon("BookOpen", [
  ["path", { d: "M12 7v14", key: "1akyts" }],
  [
    "path",
    {
      d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
      key: "ruj8y"
    }
  ]
]);

// node_modules/lucide-react/dist/esm/icons/check-check.js
var CheckCheck = createLucideIcon("CheckCheck", [
  ["path", { d: "M18 6 7 17l-5-5", key: "116fxf" }],
  ["path", { d: "m22 10-7.5 7.5L13 16", key: "ke71qq" }]
]);

// node_modules/lucide-react/dist/esm/icons/check.js
var Check = createLucideIcon("Check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);

// node_modules/lucide-react/dist/esm/icons/chevron-down.js
var ChevronDown = createLucideIcon("ChevronDown", [
  ["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]
]);

// node_modules/lucide-react/dist/esm/icons/chevron-right.js
var ChevronRight = createLucideIcon("ChevronRight", [
  ["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]
]);

// node_modules/lucide-react/dist/esm/icons/clipboard-paste.js
var ClipboardPaste = createLucideIcon("ClipboardPaste", [
  [
    "path",
    { d: "M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z", key: "1pp7kr" }
  ],
  [
    "path",
    {
      d: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10",
      key: "2ik1ml"
    }
  ],
  ["path", { d: "m17 10 4 4-4 4", key: "vp2hj1" }]
]);

// node_modules/lucide-react/dist/esm/icons/clock.js
var Clock = createLucideIcon("Clock", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["polyline", { points: "12 6 12 12 16 14", key: "68esgv" }]
]);

// node_modules/lucide-react/dist/esm/icons/code.js
var Code = createLucideIcon("Code", [
  ["polyline", { points: "16 18 22 12 16 6", key: "z7tu5w" }],
  ["polyline", { points: "8 6 2 12 8 18", key: "1eg1df" }]
]);

// node_modules/lucide-react/dist/esm/icons/copy.js
var Copy = createLucideIcon("Copy", [
  ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
  ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
]);

// node_modules/lucide-react/dist/esm/icons/download.js
var Download = createLucideIcon("Download", [
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["polyline", { points: "7 10 12 15 17 10", key: "2ggqvy" }],
  ["line", { x1: "12", x2: "12", y1: "15", y2: "3", key: "1vk2je" }]
]);

// node_modules/lucide-react/dist/esm/icons/ellipsis.js
var Ellipsis = createLucideIcon("Ellipsis", [
  ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
  ["circle", { cx: "19", cy: "12", r: "1", key: "1wjl8i" }],
  ["circle", { cx: "5", cy: "12", r: "1", key: "1pcz8c" }]
]);

// node_modules/lucide-react/dist/esm/icons/external-link.js
var ExternalLink = createLucideIcon("ExternalLink", [
  ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
  ["path", { d: "M10 14 21 3", key: "gplh6r" }],
  ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
]);

// node_modules/lucide-react/dist/esm/icons/file-text.js
var FileText = createLucideIcon("FileText", [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
  ["path", { d: "M10 9H8", key: "b1mrlr" }],
  ["path", { d: "M16 13H8", key: "t4e002" }],
  ["path", { d: "M16 17H8", key: "z1uh3a" }]
]);

// node_modules/lucide-react/dist/esm/icons/git-branch.js
var GitBranch = createLucideIcon("GitBranch", [
  ["line", { x1: "6", x2: "6", y1: "3", y2: "15", key: "17qcm7" }],
  ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
  ["path", { d: "M18 9a9 9 0 0 1-9 9", key: "n2h4wq" }]
]);

// node_modules/lucide-react/dist/esm/icons/layout-grid.js
var LayoutGrid = createLucideIcon("LayoutGrid", [
  ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1", key: "1g98yp" }],
  ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1", key: "6d4xhi" }],
  ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1", key: "nxv5o0" }],
  ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }]
]);

// node_modules/lucide-react/dist/esm/icons/list.js
var List = createLucideIcon("List", [
  ["path", { d: "M3 12h.01", key: "nlz23k" }],
  ["path", { d: "M3 18h.01", key: "1tta3j" }],
  ["path", { d: "M3 6h.01", key: "1rqtza" }],
  ["path", { d: "M8 12h13", key: "1za7za" }],
  ["path", { d: "M8 18h13", key: "1lx6n3" }],
  ["path", { d: "M8 6h13", key: "ik3vkj" }]
]);

// node_modules/lucide-react/dist/esm/icons/loader-circle.js
var LoaderCircle = createLucideIcon("LoaderCircle", [
  ["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]
]);

// node_modules/lucide-react/dist/esm/icons/message-square.js
var MessageSquare = createLucideIcon("MessageSquare", [
  ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }]
]);

// node_modules/lucide-react/dist/esm/icons/panels-top-left.js
var PanelsTopLeft = createLucideIcon("PanelsTopLeft", [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
  ["path", { d: "M3 9h18", key: "1pudct" }],
  ["path", { d: "M9 21V9", key: "1oto5p" }]
]);

// node_modules/lucide-react/dist/esm/icons/paperclip.js
var Paperclip = createLucideIcon("Paperclip", [
  ["path", { d: "M13.234 20.252 21 12.3", key: "1cbrk9" }],
  [
    "path",
    {
      d: "m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486",
      key: "1pkts6"
    }
  ]
]);

// node_modules/lucide-react/dist/esm/icons/pause.js
var Pause = createLucideIcon("Pause", [
  ["rect", { x: "14", y: "4", width: "4", height: "16", rx: "1", key: "zuxfzm" }],
  ["rect", { x: "6", y: "4", width: "4", height: "16", rx: "1", key: "1okwgv" }]
]);

// node_modules/lucide-react/dist/esm/icons/pencil.js
var Pencil = createLucideIcon("Pencil", [
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
      key: "1a8usu"
    }
  ],
  ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
]);

// node_modules/lucide-react/dist/esm/icons/play.js
var Play = createLucideIcon("Play", [
  ["polygon", { points: "6 3 20 12 6 21 6 3", key: "1oa8hb" }]
]);

// node_modules/lucide-react/dist/esm/icons/plus.js
var Plus = createLucideIcon("Plus", [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "M12 5v14", key: "s699le" }]
]);

// node_modules/lucide-react/dist/esm/icons/refresh-cw.js
var RefreshCw = createLucideIcon("RefreshCw", [
  ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
  ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
  ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
  ["path", { d: "M8 16H3v5", key: "1cv678" }]
]);

// node_modules/lucide-react/dist/esm/icons/save.js
var Save = createLucideIcon("Save", [
  [
    "path",
    {
      d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      key: "1c8476"
    }
  ],
  ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }],
  ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }]
]);

// node_modules/lucide-react/dist/esm/icons/search.js
var Search = createLucideIcon("Search", [
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
  ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }]
]);

// node_modules/lucide-react/dist/esm/icons/send.js
var Send = createLucideIcon("Send", [
  [
    "path",
    {
      d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
      key: "1ffxy3"
    }
  ],
  ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }]
]);

// node_modules/lucide-react/dist/esm/icons/settings-2.js
var Settings2 = createLucideIcon("Settings2", [
  ["path", { d: "M20 7h-9", key: "3s1dr2" }],
  ["path", { d: "M14 17H5", key: "gfn3mx" }],
  ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }],
  ["circle", { cx: "7", cy: "7", r: "3", key: "dfmy0x" }]
]);

// node_modules/lucide-react/dist/esm/icons/skip-forward.js
var SkipForward = createLucideIcon("SkipForward", [
  ["polygon", { points: "5 4 15 12 5 20 5 4", key: "16p6eg" }],
  ["line", { x1: "19", x2: "19", y1: "5", y2: "19", key: "futhcm" }]
]);

// node_modules/lucide-react/dist/esm/icons/sparkles.js
var Sparkles = createLucideIcon("Sparkles", [
  [
    "path",
    {
      d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
      key: "4pj2yx"
    }
  ],
  ["path", { d: "M20 3v4", key: "1olli1" }],
  ["path", { d: "M22 5h-4", key: "1gvqau" }],
  ["path", { d: "M4 17v2", key: "vumght" }],
  ["path", { d: "M5 18H3", key: "zchphs" }]
]);

// node_modules/lucide-react/dist/esm/icons/square.js
var Square = createLucideIcon("Square", [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }]
]);

// node_modules/lucide-react/dist/esm/icons/step-forward.js
var StepForward = createLucideIcon("StepForward", [
  ["line", { x1: "6", x2: "6", y1: "4", y2: "20", key: "fy8qot" }],
  ["polygon", { points: "10,4 20,12 10,20", key: "1mc1pf" }]
]);

// node_modules/lucide-react/dist/esm/icons/text-cursor-input.js
var TextCursorInput = createLucideIcon("TextCursorInput", [
  ["path", { d: "M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1", key: "18xjzo" }],
  ["path", { d: "M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5", key: "fj48gi" }],
  ["path", { d: "M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1", key: "1n9rhb" }],
  ["path", { d: "M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7", key: "13ksps" }],
  ["path", { d: "M9 7v10", key: "1vc8ob" }]
]);

// node_modules/lucide-react/dist/esm/icons/trash-2.js
var Trash2 = createLucideIcon("Trash2", [
  ["path", { d: "M3 6h18", key: "d0wm0j" }],
  ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
  ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
  ["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
  ["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }]
]);

// node_modules/lucide-react/dist/esm/icons/triangle-alert.js
var TriangleAlert = createLucideIcon("TriangleAlert", [
  [
    "path",
    {
      d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      key: "wmoenq"
    }
  ],
  ["path", { d: "M12 9v4", key: "juzpu7" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }]
]);

// node_modules/lucide-react/dist/esm/icons/undo-2.js
var Undo2 = createLucideIcon("Undo2", [
  ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
  ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
]);

// node_modules/lucide-react/dist/esm/icons/upload.js
var Upload = createLucideIcon("Upload", [
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["polyline", { points: "17 8 12 3 7 8", key: "t8dd8p" }],
  ["line", { x1: "12", x2: "12", y1: "3", y2: "15", key: "widbto" }]
]);

// node_modules/lucide-react/dist/esm/icons/workflow.js
var Workflow = createLucideIcon("Workflow", [
  ["rect", { width: "8", height: "8", x: "3", y: "3", rx: "2", key: "by2w9f" }],
  ["path", { d: "M7 11v4a2 2 0 0 0 2 2h4", key: "xkn7yn" }],
  ["rect", { width: "8", height: "8", x: "13", y: "13", rx: "2", key: "1cgmvn" }]
]);

// node_modules/lucide-react/dist/esm/icons/x.js
var X = createLucideIcon("X", [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
]);

// client/step-outline.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var descriptions = {
  input: "\u63D0\u4F9B\u672C\u6B21\u4EFB\u52A1\u7684\u6750\u6599",
  interact: "\u5411\u7528\u6237\u63D0\u95EE\u5E76\u7B49\u5F85\u56DE\u7B54",
  agent: "\u7531 Agent \u5B8C\u6210\u4E00\u9879\u4EFB\u52A1",
  artifact: "\u4FDD\u5B58\u7ED3\u679C\u4E0E\u6587\u4EF6",
  publish: "\u53D1\u5E03\u5BA1\u6838\u901A\u8FC7\u7684\u5185\u5BB9",
  tool: "\u8C03\u7528\u6307\u5B9A\u5DE5\u5177",
  condition: "\u6309\u6761\u4EF6\u9009\u62E9\u540E\u7EED\u6B65\u9AA4",
  join: "\u6C47\u603B\u524D\u5E8F\u7ED3\u679C",
  loop: "\u6309\u6761\u4EF6\u91CD\u590D\u6267\u884C",
  subworkflow: "\u8C03\u7528\u53E6\u4E00\u5DE5\u4F5C\u6D41",
  approval: "\u7B49\u5F85\u7528\u6237\u786E\u8BA4"
};
function StepOutline({ definition, selected: selected2, onSelect, onDelete }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "wf-outline", "aria-label": "\u5DE5\u4F5C\u6D41\u6B65\u9AA4\u5217\u8868", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u4EFB\u52A1\u6B65\u9AA4" }) }),
    !definition.nodes.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wf-panel-empty", children: "\u4ECE\u4E0A\u65B9\u6DFB\u52A0\u4E00\u4E2A\u6B65\u9AA4" }),
    definition.nodes.map((node, index2) => {
      const inputs = definition.edges.filter((e) => e.to === node.id).map((e) => definition.nodes.find((n) => n.id === e.from)?.name).filter(Boolean);
      const output = definition.edges.some((e) => e.from === node.id);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wf-outline-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "wf-outline-step", "aria-pressed": selected2 === node.id, onClick: () => onSelect(node.id), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wf-outline-number", children: String(index2 + 1).padStart(2, "0") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "wf-outline-copy", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: node.name }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: node.prompt || descriptions[node.kind] || "\u914D\u7F6E\u6B65\u9AA4\u4EFB\u52A1" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
              "\u6750\u6599\uFF1A",
              inputs.length ? inputs.join("\u3001") : "\u672C\u6B21\u4EFB\u52A1\u8F93\u5165",
              !output ? " \xB7 \u5F62\u6210\u6700\u7EC8\u7ED3\u679C" : ""
            ] }),
            node.repeat && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
              "\u8BC4\u5BA1\u672A\u901A\u8FC7\u65F6\u8FD4\u56DE\u4FEE\u8BA2 \xB7 \u6700\u591A ",
              node.repeat.maxRounds,
              " \u8F6E"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { size: 16, "aria-hidden": "true" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "wf-outline-delete", "aria-label": `\u5220\u9664\u6B65\u9AA4 ${node.name}`, title: "\u5220\u9664\u6B65\u9AA4\uFF0C\u53EF\u64A4\u9500\u6062\u590D", onClick: () => onDelete(node.id), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 16 }) })
      ] }, node.id);
    })
  ] });
}

// client/gallery.jsx
var import_react4 = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// client/history.js
function workflowHistory(data, sessions, archivedIds, workflowId) {
  const archived = new Set(archivedIds);
  const runs = new Set(data.runs.filter((r) => r.workflowId === workflowId).map((r) => r.sessionId));
  return data.references.filter((r) => {
    const session = sessions.byId[r.sessionId];
    return r.workflowId === workflowId && session && !archived.has(r.sessionId) && (session.blank === false || r.hasHistory === true || runs.has(r.sessionId));
  });
}

// client/gallery.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function createGallery({ ctx, api, refresh, openSession, openEditor, bind, beginAuthorSession, useSessions, Icon: Icon3, glyphFor: glyphFor2, timestamp: timestamp2 }) {
  function WorkflowSessions({ workflow, data, sessions, onError }) {
    const [menuSession, setMenuSession] = (0, import_react4.useState)(null);
    const perform = (fn) => Promise.resolve().then(fn).catch((e) => onError(e.message));
    const act = async (action, sessionId, title) => {
      setMenuSession(null);
      if (action === "copy") {
        if (window.__dshSessionActions?.copy) {
          await window.__dshSessionActions.copy(sessionId, title);
        } else {
          throw new Error("\u590D\u5236\u4F1A\u8BDD\u5F15\u7528\u9700\u8981\u5B89\u88C5\u4F1A\u8BDD\u5DE5\u5177\u63D2\u4EF6");
        }
      } else if (action === "rename") {
        const next = window.prompt("\u91CD\u547D\u540D\u4F1A\u8BDD", title || "");
        if (next?.trim()) {
          const session = ctx.sessions.binding(sessionId)?.session;
          if (!session) throw new Error("\u4F1A\u8BDD\u5C1A\u672A\u5C31\u7EEA");
          const result = await session.rename(next.trim());
          if (!result.ok) throw new Error(result.error.message);
          await ctx.sessions.refresh();
        }
      } else if (action === "fork") {
        const childId = await ctx.sessions.fork({ sessionId, increaseTitle: true });
        const binding = data.bindings.find((item) => item.sessionId === sessionId);
        if (binding)
          await api({
            action: "bind",
            sessionId: childId,
            id: binding.workflowId,
            revision: binding.revision,
            mode: binding.mode
          });
        await ctx.sessions.refresh();
        await refresh();
        openSession(childId);
      } else if (action === "archive") {
        await ctx.uiWorkspace.archiveSession(sessionId);
        await ctx.sessions.refresh();
        await refresh();
      }
    };
    const rows = workflowHistory(data, sessions, ctx.workspaces.list.getSnapshot().archivedSessionIds, workflow.id);
    if (!rows.length)
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "wf-sessions-empty", children: "\u8FD8\u6CA1\u6709\u5386\u53F2\u5BF9\u8BDD" });
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "wf-sessions", children: rows.map((r) => {
      const title = sessions.byId[r.sessionId].displayTitle;
      const openMenu = menuSession === r.sessionId;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          className: "wf-session-row " + (sessions.current === r.sessionId ? "selected" : ""),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                className: "wf-session-name",
                title,
                onClick: () => {
                  openSession(r.sessionId);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MessageSquare, { size: 13, "aria-hidden": "true" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: title })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_dsh_client_ui_primitives.Menu,
              {
                open: openMenu,
                onClose: () => setMenuSession(null),
                onSelect: (action) => perform(() => act(action, r.sessionId, title)),
                items: [
                  { id: "copy", label: "\u590D\u5236\u4F1A\u8BDD\u5F15\u7528", icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Copy, { size: 16 }) },
                  { id: "rename", label: "\u91CD\u547D\u540D", icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Pencil, { size: 16 }) },
                  { id: "fork", label: "\u5206\u53C9\u4F1A\u8BDD", icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GitBranch, { size: 16 }) },
                  { id: "archive", label: "\u5F52\u6863\u4F1A\u8BDD", icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Archive, { size: 16 }) }
                ],
                anchor: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "wf-session-menu-trigger wf-row-action",
                    "aria-label": `\u4F1A\u8BDD\u201C${title}\u201D\u7684\u64CD\u4F5C`,
                    "aria-expanded": openMenu,
                    onClick: (event) => {
                      event.stopPropagation();
                      setMenuSession(openMenu ? null : r.sessionId);
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Ellipsis, { size: 15 })
                  }
                )
              }
            )
          ]
        },
        r.sessionId
      );
    }) });
  }
  function Gallery({ data, onError }) {
    const sessions = useSessions();
    const [view, setView] = (0, import_react4.useState)(
      () => localStorage.getItem("workflow-studio:view") ?? "cards"
    );
    const [archived, setArchived] = (0, import_react4.useState)(false);
    const [query, setQuery] = (0, import_react4.useState)("");
    const [detail, setDetail] = (0, import_react4.useState)(/* @__PURE__ */ new Set());
    const [feedback, setFeedback] = (0, import_react4.useState)(null);
    const [pending, setPending] = (0, import_react4.useState)("");
    const [creating, setCreating] = (0, import_react4.useState)(false);
    const perform = (fn) => Promise.resolve().then(fn).catch((e) => onError(e.message));
    const choose = (next) => {
      localStorage.setItem("workflow-studio:view", next);
      setView(next);
    };
    const conversations = (id2) => workflowHistory(data, sessions, ctx.workspaces.list.getSnapshot().archivedSessionIds, id2).length;
    const copy = (record) => perform(async () => {
      if (pending) return;
      setPending(record.id);
      try {
        const created = await api({ action: "copy", id: record.id });
        await refresh();
        openEditor(created.id);
      } finally {
        setPending("");
      }
    });
    const archive = (record) => perform(async () => {
      if (pending) return;
      setPending(record.id);
      try {
        await api({ action: "archive", id: record.id, archived: !record.archived });
        await refresh();
        setFeedback({
          workflowId: record.id,
          name: record.name,
          text: record.archived ? `\u5DF2\u6062\u590D\u300C${record.name}\u300D` : `\u5DF2\u5F52\u6863\u300C${record.name}\u300D\uFF0C\u53EF\u5728\u300C\u5DF2\u5F52\u6863\u300D\u91CC\u6062\u590D`
        });
      } finally {
        setPending("");
      }
    });
    const undoArchive = (entry) => perform(async () => {
      const record = data.workflows.find((w) => w.id === entry.workflowId);
      if (!record) return;
      await api({ action: "archive", id: record.id, archived: !record.archived });
      await refresh();
      setFeedback(null);
    });
    const trimmed = query.trim();
    const rows = data.workflows.filter((w) => w.archived === archived && `${w.name} ${w.description ?? ""}`.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase()));
    const empty2 = !rows.length;
    const scopeLabel = archived ? "\u5DF2\u5F52\u6863\u7684\u5DE5\u4F5C\u6D41" : "\u5DE5\u4F5C\u6D41";
    const countText = empty2 ? trimmed ? "\u6CA1\u6709\u5339\u914D\u7684\u5DE5\u4F5C\u6D41" : archived ? "\u6CA1\u6709\u5DF2\u5F52\u6863\u7684\u5DE5\u4F5C\u6D41" : "\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u6D41" : trimmed ? `\u5339\u914D ${rows.length} / ${data.workflows.filter((w) => w.archived === archived).length} \u4E2A` : `${rows.length} \u4E2A\u5DE5\u4F5C\u6D41`;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wf-scroll wf-gallery", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wf-gallery-bar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "wf-gallery-search", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Search, { size: 16, "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              "aria-label": "\u641C\u7D22\u5DE5\u4F5C\u6D41",
              placeholder: "\u641C\u7D22\u5DE5\u4F5C\u6D41",
              value: query,
              onChange: (e) => setQuery(e.target.value)
            }
          ),
          query && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "wf-search-clear",
              "aria-label": "\u6E05\u9664\u641C\u7D22",
              onClick: () => setQuery(""),
              children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(X, { size: 14, "aria-hidden": "true" })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "wf-gallery-count", role: "status", "aria-atomic": "true", children: countText }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "wf-spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "wf-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              type: "checkbox",
              checked: archived,
              onChange: (e) => setArchived(e.target.checked)
            }
          ),
          "\u5DF2\u5F52\u6863"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wf-segmented", role: "tablist", "aria-label": "\u5DE5\u4F5C\u6D41\u6837\u5F0F", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              role: "tab",
              "aria-selected": view === "cards",
              onClick: () => choose("cards"),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(LayoutGrid, { size: 15, "aria-hidden": "true" }),
                "\u5361\u7247"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              role: "tab",
              "aria-selected": view === "list",
              onClick: () => choose("list"),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(List, { size: 15, "aria-hidden": "true" }),
                "\u5217\u8868"
              ]
            }
          )
        ] })
      ] }),
      feedback && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wf-gallery-feedback", role: "status", "aria-live": "polite", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Archive, { size: 15, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: feedback.text }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", onClick: () => undoArchive(feedback), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Undo2, { size: 14, "aria-hidden": "true" }),
          "\u64A4\u9500"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon3, { label: "\u5173\u95ED\u63D0\u793A", icon: X, onClick: () => setFeedback(null) })
      ] }),
      empty2 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wf-gallery-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: trimmed ? `\u6CA1\u6709\u627E\u5230\u5339\u914D\u300C${trimmed}\u300D\u7684${scopeLabel}` : archived ? "\u8FD8\u6CA1\u6709\u5F52\u6863\u7684\u5DE5\u4F5C\u6D41" : "\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u6D41" }),
        trimmed && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { onClick: () => setQuery(""), children: "\u6E05\u9664\u641C\u7D22" }),
        !archived && !trimmed && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            className: "wf-primary",
            disabled: creating,
            "aria-busy": creating,
            onClick: () => perform(async () => {
              if (creating) return;
              setCreating(true);
              try {
                await beginAuthorSession();
              } finally {
                setCreating(false);
              }
            }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Plus, { size: 16, "aria-hidden": "true" }),
              creating ? "\u6B63\u5728\u521B\u5EFA\u2026" : "\u521B\u5EFA\u5DE5\u4F5C\u6D41"
            ]
          }
        ),
        archived && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { onClick: () => setArchived(false), children: "\u8FD4\u56DE\u5DE5\u4F5C\u6D41\u5217\u8868" })
      ] }) : view === "cards" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "wf-cards", children: rows.map((w) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("article", { className: "wf-card", "data-workflow-card": w.id, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            className: "wf-card-head",
            onClick: () => openEditor(w.id),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "span",
                {
                  className: `wf-workflow-icon wf-icon-${w.icon ?? "workflow"}`,
                  "aria-hidden": "true",
                  children: glyphFor2(w.icon ?? "workflow", 15)
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "wf-card-title", title: w.name, children: w.name }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "span",
                {
                  className: `wf-chip ${w.published === w.revision ? "is-published" : ""}`,
                  children: w.published ? `\u5DF2\u53D1\u5E03 v${w.published}` : `\u8349\u7A3F v${w.revision}`
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "wf-card-desc", title: w.description || "\u8FD8\u6CA1\u6709\u63CF\u8FF0", children: w.description || "\u8FD8\u6CA1\u6709\u63CF\u8FF0" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "wf-card-meta", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          "\u6700\u8FD1\u4FEE\u6539 ",
          timestamp2(w.updatedAt)
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wf-card-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { onClick: () => openEditor(w.id), children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Settings2, { size: 15, "aria-hidden": "true" }),
            "\u6253\u5F00"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              className: "wf-run-action",
              disabled: w.archived,
              onClick: () => perform(() => bind(w)),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Play, { size: 15, "aria-hidden": "true" }),
                "\u8FD0\u884C"
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { disabled: pending === w.id, onClick: () => copy(w), children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Copy, { size: 15, "aria-hidden": "true" }),
            pending === w.id ? "\u5904\u7406\u4E2D\u2026" : "\u62F7\u8D1D"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              className: "wf-archive-action",
              "aria-label": w.archived ? `\u6062\u590D ${w.name}` : `\u5F52\u6863 ${w.name}`,
              disabled: pending === w.id,
              onClick: () => archive(w),
              children: [
                w.archived ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ArchiveRestore, { size: 15, "aria-hidden": "true" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Archive, { size: 15, "aria-hidden": "true" }),
                w.archived ? "\u6062\u590D" : "\u5F52\u6863"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { className: "wf-card-sessions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("summary", { children: [
            "\u5BF9\u8BDD ",
            conversations(w.id) ? `(${conversations(w.id)})` : ""
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            WorkflowSessions,
            {
              workflow: w,
              data,
              sessions,
              onError
            }
          )
        ] })
      ] }, w.id)) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("table", { className: "wf-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { children: "\u5DE5\u4F5C\u6D41" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { children: "\u7248\u672C" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { children: "\u5BF9\u8BDD" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { children: "\u6700\u8FD1\u4FEE\u6539" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { children: "\u64CD\u4F5C" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("tbody", { children: rows.map((w) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react4.default.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("tr", { "data-workflow-row": w.id, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("td", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  className: "wf-link wf-list-title",
                  title: w.name,
                  onClick: () => openEditor(w.id),
                  children: w.name
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { className: "wf-list-desc", title: w.description, children: w.description })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { children: w.published ? `\u5DF2\u53D1\u5E03 v${w.published}` : `\u8349\u7A3F v${w.revision}` }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                className: "wf-link",
                "aria-expanded": detail.has(w.id),
                onClick: () => setDetail((old) => {
                  const next = new Set(old);
                  next.has(w.id) ? next.delete(w.id) : next.add(w.id);
                  return next;
                }),
                children: [
                  conversations(w.id),
                  " \u4E2A\u5BF9\u8BDD"
                ]
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { children: timestamp2(w.updatedAt) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("td", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                Icon3,
                {
                  label: `\u8FD0\u884C ${w.name}`,
                  icon: Play,
                  disabled: w.archived,
                  onClick: () => perform(() => bind(w))
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                Icon3,
                {
                  label: `\u62F7\u8D1D ${w.name}`,
                  icon: Copy,
                  disabled: pending === w.id,
                  onClick: () => copy(w)
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                Icon3,
                {
                  label: `\u7F16\u8F91 ${w.name}`,
                  icon: Settings2,
                  onClick: () => openEditor(w.id)
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                Icon3,
                {
                  label: w.archived ? `\u6062\u590D ${w.name}` : `\u5F52\u6863 ${w.name}`,
                  icon: w.archived ? ArchiveRestore : Archive,
                  disabled: pending === w.id,
                  onClick: () => archive(w)
                }
              )
            ] })
          ] }),
          detail.has(w.id) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("tr", { className: "wf-detail-row", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { colSpan: 5, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            WorkflowSessions,
            {
              workflow: w,
              data,
              sessions,
              onError
            }
          ) }) })
        ] }, w.id)) })
      ] })
    ] });
  }
  return Gallery;
}

// client/index.jsx
var import_react11 = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// node_modules/@xyflow/react/dist/esm/index.js
var import_jsx_runtime3 = require("react/jsx-runtime");
var import_react6 = require("react");

// node_modules/classcat/index.js
function cc(names2) {
  if (typeof names2 === "string" || typeof names2 === "number") return "" + names2;
  let out = "";
  if (Array.isArray(names2)) {
    for (let i = 0, tmp; i < names2.length; i++) {
      if ((tmp = cc(names2[i])) !== "") {
        out += (out && " ") + tmp;
      }
    }
  } else {
    for (let k in names2) {
      if (names2[k]) out += (out && " ") + k;
    }
  }
  return out;
}

// node_modules/d3-dispatch/src/dispatch.js
var noop = { value: () => {
} };
function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}
function Dispatch(_) {
  this._ = _;
}
function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name2 = "", i = t.indexOf(".");
    if (i >= 0) name2 = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return { type: t, name: name2 };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._, T = parseTypenames(typename + "", _), t, i = -1, n = T.length;
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};
function get(type, name2) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name2) {
      return c.value;
    }
  }
}
function set(type, name2, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name2) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({ name: name2, value: callback });
  return type;
}
var dispatch_default = dispatch;

// node_modules/d3-selection/src/namespaces.js
var xhtml = "http://www.w3.org/1999/xhtml";
var namespaces_default = {
  svg: "http://www.w3.org/2000/svg",
  xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

// node_modules/d3-selection/src/namespace.js
function namespace_default(name2) {
  var prefix = name2 += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name2.slice(0, i)) !== "xmlns") name2 = name2.slice(i + 1);
  return namespaces_default.hasOwnProperty(prefix) ? { space: namespaces_default[prefix], local: name2 } : name2;
}

// node_modules/d3-selection/src/creator.js
function creatorInherit(name2) {
  return function() {
    var document2 = this.ownerDocument, uri = this.namespaceURI;
    return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name2) : document2.createElementNS(uri, name2);
  };
}
function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}
function creator_default(name2) {
  var fullname = namespace_default(name2);
  return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}

// node_modules/d3-selection/src/selector.js
function none() {
}
function selector_default(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

// node_modules/d3-selection/src/selection/select.js
function select_default(select) {
  if (typeof select !== "function") select = selector_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/array.js
function array(x) {
  return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
}

// node_modules/d3-selection/src/selectorAll.js
function empty() {
  return [];
}
function selectorAll_default(selector) {
  return selector == null ? empty : function() {
    return this.querySelectorAll(selector);
  };
}

// node_modules/d3-selection/src/selection/selectAll.js
function arrayAll(select) {
  return function() {
    return array(select.apply(this, arguments));
  };
}
function selectAll_default(select) {
  if (typeof select === "function") select = arrayAll(select);
  else select = selectorAll_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        subgroups.push(select.call(node, node.__data__, i, group));
        parents.push(node);
      }
    }
  }
  return new Selection(subgroups, parents);
}

// node_modules/d3-selection/src/matcher.js
function matcher_default(selector) {
  return function() {
    return this.matches(selector);
  };
}
function childMatcher(selector) {
  return function(node) {
    return node.matches(selector);
  };
}

// node_modules/d3-selection/src/selection/selectChild.js
var find = Array.prototype.find;
function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}
function childFirst() {
  return this.firstElementChild;
}
function selectChild_default(match) {
  return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/selectChildren.js
var filter = Array.prototype.filter;
function children() {
  return Array.from(this.children);
}
function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}
function selectChildren_default(match) {
  return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/filter.js
function filter_default(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/selection/sparse.js
function sparse_default(update) {
  return new Array(update.length);
}

// node_modules/d3-selection/src/selection/enter.js
function enter_default() {
  return new Selection(this._enter || this._groups.map(sparse_default), this._parents);
}
function EnterNode(parent, datum2) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum2;
}
EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) {
    return this._parent.insertBefore(child, this._next);
  },
  insertBefore: function(child, next) {
    return this._parent.insertBefore(child, next);
  },
  querySelector: function(selector) {
    return this._parent.querySelector(selector);
  },
  querySelectorAll: function(selector) {
    return this._parent.querySelectorAll(selector);
  }
};

// node_modules/d3-selection/src/constant.js
function constant_default(x) {
  return function() {
    return x;
  };
}

// node_modules/d3-selection/src/selection/data.js
function bindIndex(parent, group, enter, update, exit, data) {
  var i = 0, node, groupLength = group.length, dataLength = data.length;
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}
function bindKey(parent, group, enter, update, exit, data, key) {
  var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }
  for (i = 0; i < dataLength; ++i) {
    keyValue = key.call(parent, data[i], i, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && nodeByKeyValue.get(keyValues[i]) === node) {
      exit[i] = node;
    }
  }
}
function datum(node) {
  return node.__data__;
}
function data_default(value, key) {
  if (!arguments.length) return Array.from(this, datum);
  var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
  if (typeof value !== "function") value = constant_default(value);
  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
    var parent = parents[j], group = groups[j], groupLength = group.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength), exitGroup = exit[j] = new Array(groupLength);
    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength) ;
        previous._next = next || null;
      }
    }
  }
  update = new Selection(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}
function arraylike(data) {
  return typeof data === "object" && "length" in data ? data : Array.from(data);
}

// node_modules/d3-selection/src/selection/exit.js
function exit_default() {
  return new Selection(this._exit || this._groups.map(sparse_default), this._parents);
}

// node_modules/d3-selection/src/selection/join.js
function join_default(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter) enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update) update = update.selection();
  }
  if (onexit == null) exit.remove();
  else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

// node_modules/d3-selection/src/selection/merge.js
function merge_default(context) {
  var selection2 = context.selection ? context.selection() : context;
  for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Selection(merges, this._parents);
}

// node_modules/d3-selection/src/selection/order.js
function order_default() {
  for (var groups = this._groups, j = -1, m = groups.length; ++j < m; ) {
    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0; ) {
      if (node = group[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/sort.js
function sort_default(compare) {
  if (!compare) compare = ascending;
  function compareNode(a, b) {
    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
  }
  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }
  return new Selection(sortgroups, this._parents).order();
}
function ascending(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

// node_modules/d3-selection/src/selection/call.js
function call_default() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

// node_modules/d3-selection/src/selection/nodes.js
function nodes_default() {
  return Array.from(this);
}

// node_modules/d3-selection/src/selection/node.js
function node_default() {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
      var node = group[i];
      if (node) return node;
    }
  }
  return null;
}

// node_modules/d3-selection/src/selection/size.js
function size_default() {
  let size = 0;
  for (const node of this) ++size;
  return size;
}

// node_modules/d3-selection/src/selection/empty.js
function empty_default() {
  return !this.node();
}

// node_modules/d3-selection/src/selection/each.js
function each_default(callback) {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) callback.call(node, node.__data__, i, group);
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/attr.js
function attrRemove(name2) {
  return function() {
    this.removeAttribute(name2);
  };
}
function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant(name2, value) {
  return function() {
    this.setAttribute(name2, value);
  };
}
function attrConstantNS(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}
function attrFunction(name2, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name2);
    else this.setAttribute(name2, v);
  };
}
function attrFunctionNS(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}
function attr_default(name2, value) {
  var fullname = namespace_default(name2);
  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
  }
  return this.each((value == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value));
}

// node_modules/d3-selection/src/window.js
function window_default(node) {
  return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}

// node_modules/d3-selection/src/selection/style.js
function styleRemove(name2) {
  return function() {
    this.style.removeProperty(name2);
  };
}
function styleConstant(name2, value, priority) {
  return function() {
    this.style.setProperty(name2, value, priority);
  };
}
function styleFunction(name2, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name2);
    else this.style.setProperty(name2, v, priority);
  };
}
function style_default(name2, value, priority) {
  return arguments.length > 1 ? this.each((value == null ? styleRemove : typeof value === "function" ? styleFunction : styleConstant)(name2, value, priority == null ? "" : priority)) : styleValue(this.node(), name2);
}
function styleValue(node, name2) {
  return node.style.getPropertyValue(name2) || window_default(node).getComputedStyle(node, null).getPropertyValue(name2);
}

// node_modules/d3-selection/src/selection/property.js
function propertyRemove(name2) {
  return function() {
    delete this[name2];
  };
}
function propertyConstant(name2, value) {
  return function() {
    this[name2] = value;
  };
}
function propertyFunction(name2, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name2];
    else this[name2] = v;
  };
}
function property_default(name2, value) {
  return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name2, value)) : this.node()[name2];
}

// node_modules/d3-selection/src/selection/classed.js
function classArray(string) {
  return string.trim().split(/^|\s+/);
}
function classList(node) {
  return node.classList || new ClassList(node);
}
function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
  add: function(name2) {
    var i = this._names.indexOf(name2);
    if (i < 0) {
      this._names.push(name2);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name2) {
    var i = this._names.indexOf(name2);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name2) {
    return this._names.indexOf(name2) >= 0;
  }
};
function classedAdd(node, names2) {
  var list = classList(node), i = -1, n = names2.length;
  while (++i < n) list.add(names2[i]);
}
function classedRemove(node, names2) {
  var list = classList(node), i = -1, n = names2.length;
  while (++i < n) list.remove(names2[i]);
}
function classedTrue(names2) {
  return function() {
    classedAdd(this, names2);
  };
}
function classedFalse(names2) {
  return function() {
    classedRemove(this, names2);
  };
}
function classedFunction(names2, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names2);
  };
}
function classed_default(name2, value) {
  var names2 = classArray(name2 + "");
  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names2.length;
    while (++i < n) if (!list.contains(names2[i])) return false;
    return true;
  }
  return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names2, value));
}

// node_modules/d3-selection/src/selection/text.js
function textRemove() {
  this.textContent = "";
}
function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}
function text_default(value) {
  return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction : textConstant)(value)) : this.node().textContent;
}

// node_modules/d3-selection/src/selection/html.js
function htmlRemove() {
  this.innerHTML = "";
}
function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}
function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}
function html_default(value) {
  return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}

// node_modules/d3-selection/src/selection/raise.js
function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}
function raise_default() {
  return this.each(raise);
}

// node_modules/d3-selection/src/selection/lower.js
function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function lower_default() {
  return this.each(lower);
}

// node_modules/d3-selection/src/selection/append.js
function append_default(name2) {
  var create2 = typeof name2 === "function" ? name2 : creator_default(name2);
  return this.select(function() {
    return this.appendChild(create2.apply(this, arguments));
  });
}

// node_modules/d3-selection/src/selection/insert.js
function constantNull() {
  return null;
}
function insert_default(name2, before) {
  var create2 = typeof name2 === "function" ? name2 : creator_default(name2), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
  return this.select(function() {
    return this.insertBefore(create2.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

// node_modules/d3-selection/src/selection/remove.js
function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}
function remove_default() {
  return this.each(remove);
}

// node_modules/d3-selection/src/selection/clone.js
function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function clone_default(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

// node_modules/d3-selection/src/selection/datum.js
function datum_default(value) {
  return arguments.length ? this.property("__data__", value) : this.node().__data__;
}

// node_modules/d3-selection/src/selection/on.js
function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}
function parseTypenames2(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name2 = "", i = t.indexOf(".");
    if (i >= 0) name2 = t.slice(i + 1), t = t.slice(0, i);
    return { type: t, name: name2 };
  });
}
function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}
function onAdd(typename, value, options) {
  return function() {
    var on = this.__on, o, listener = contextListener(value);
    if (on) for (var j = 0, m = on.length; j < m; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
        this.addEventListener(o.type, o.listener = listener, o.options = options);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, options);
    o = { type: typename.type, name: typename.name, value, listener, options };
    if (!on) this.__on = [o];
    else on.push(o);
  };
}
function on_default(typename, value, options) {
  var typenames = parseTypenames2(typename + ""), i, n = typenames.length, t;
  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }
  on = value ? onAdd : onRemove;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
  return this;
}

// node_modules/d3-selection/src/selection/dispatch.js
function dispatchEvent(node, type, params) {
  var window2 = window_default(node), event = window2.CustomEvent;
  if (typeof event === "function") {
    event = new event(type, params);
  } else {
    event = window2.document.createEvent("Event");
    if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type, false, false);
  }
  node.dispatchEvent(event);
}
function dispatchConstant(type, params) {
  return function() {
    return dispatchEvent(this, type, params);
  };
}
function dispatchFunction(type, params) {
  return function() {
    return dispatchEvent(this, type, params.apply(this, arguments));
  };
}
function dispatch_default2(type, params) {
  return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type, params));
}

// node_modules/d3-selection/src/selection/iterator.js
function* iterator_default() {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) yield node;
    }
  }
}

// node_modules/d3-selection/src/selection/index.js
var root = [null];
function Selection(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}
function selection() {
  return new Selection([[document.documentElement]], root);
}
function selection_selection() {
  return this;
}
Selection.prototype = selection.prototype = {
  constructor: Selection,
  select: select_default,
  selectAll: selectAll_default,
  selectChild: selectChild_default,
  selectChildren: selectChildren_default,
  filter: filter_default,
  data: data_default,
  enter: enter_default,
  exit: exit_default,
  join: join_default,
  merge: merge_default,
  selection: selection_selection,
  order: order_default,
  sort: sort_default,
  call: call_default,
  nodes: nodes_default,
  node: node_default,
  size: size_default,
  empty: empty_default,
  each: each_default,
  attr: attr_default,
  style: style_default,
  property: property_default,
  classed: classed_default,
  text: text_default,
  html: html_default,
  raise: raise_default,
  lower: lower_default,
  append: append_default,
  insert: insert_default,
  remove: remove_default,
  clone: clone_default,
  datum: datum_default,
  on: on_default,
  dispatch: dispatch_default2,
  [Symbol.iterator]: iterator_default
};
var selection_default = selection;

// node_modules/d3-selection/src/select.js
function select_default2(selector) {
  return typeof selector === "string" ? new Selection([[document.querySelector(selector)]], [document.documentElement]) : new Selection([[selector]], root);
}

// node_modules/d3-selection/src/sourceEvent.js
function sourceEvent_default(event) {
  let sourceEvent;
  while (sourceEvent = event.sourceEvent) event = sourceEvent;
  return event;
}

// node_modules/d3-selection/src/pointer.js
function pointer_default(event, node) {
  event = sourceEvent_default(event);
  if (node === void 0) node = event.currentTarget;
  if (node) {
    var svg = node.ownerSVGElement || node;
    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }
    if (node.getBoundingClientRect) {
      var rect = node.getBoundingClientRect();
      return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
    }
  }
  return [event.pageX, event.pageY];
}

// node_modules/d3-drag/src/noevent.js
var nonpassive = { passive: false };
var nonpassivecapture = { capture: true, passive: false };
function nopropagation(event) {
  event.stopImmediatePropagation();
}
function noevent_default(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

// node_modules/d3-drag/src/nodrag.js
function nodrag_default(view) {
  var root2 = view.document.documentElement, selection2 = select_default2(view).on("dragstart.drag", noevent_default, nonpassivecapture);
  if ("onselectstart" in root2) {
    selection2.on("selectstart.drag", noevent_default, nonpassivecapture);
  } else {
    root2.__noselect = root2.style.MozUserSelect;
    root2.style.MozUserSelect = "none";
  }
}
function yesdrag(view, noclick) {
  var root2 = view.document.documentElement, selection2 = select_default2(view).on("dragstart.drag", null);
  if (noclick) {
    selection2.on("click.drag", noevent_default, nonpassivecapture);
    setTimeout(function() {
      selection2.on("click.drag", null);
    }, 0);
  }
  if ("onselectstart" in root2) {
    selection2.on("selectstart.drag", null);
  } else {
    root2.style.MozUserSelect = root2.__noselect;
    delete root2.__noselect;
  }
}

// node_modules/d3-drag/src/constant.js
var constant_default2 = (x) => () => x;

// node_modules/d3-drag/src/event.js
function DragEvent(type, {
  sourceEvent,
  subject,
  target,
  identifier,
  active,
  x,
  y,
  dx,
  dy,
  dispatch: dispatch2
}) {
  Object.defineProperties(this, {
    type: { value: type, enumerable: true, configurable: true },
    sourceEvent: { value: sourceEvent, enumerable: true, configurable: true },
    subject: { value: subject, enumerable: true, configurable: true },
    target: { value: target, enumerable: true, configurable: true },
    identifier: { value: identifier, enumerable: true, configurable: true },
    active: { value: active, enumerable: true, configurable: true },
    x: { value: x, enumerable: true, configurable: true },
    y: { value: y, enumerable: true, configurable: true },
    dx: { value: dx, enumerable: true, configurable: true },
    dy: { value: dy, enumerable: true, configurable: true },
    _: { value: dispatch2 }
  });
}
DragEvent.prototype.on = function() {
  var value = this._.on.apply(this._, arguments);
  return value === this._ ? this : value;
};

// node_modules/d3-drag/src/drag.js
function defaultFilter(event) {
  return !event.ctrlKey && !event.button;
}
function defaultContainer() {
  return this.parentNode;
}
function defaultSubject(event, d) {
  return d == null ? { x: event.x, y: event.y } : d;
}
function defaultTouchable() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function drag_default() {
  var filter2 = defaultFilter, container = defaultContainer, subject = defaultSubject, touchable = defaultTouchable, gestures = {}, listeners = dispatch_default("start", "drag", "end"), active = 0, mousedownx, mousedowny, mousemoving, touchending, clickDistance2 = 0;
  function drag(selection2) {
    selection2.on("mousedown.drag", mousedowned).filter(touchable).on("touchstart.drag", touchstarted).on("touchmove.drag", touchmoved, nonpassive).on("touchend.drag touchcancel.drag", touchended).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function mousedowned(event, d) {
    if (touchending || !filter2.call(this, event, d)) return;
    var gesture = beforestart(this, container.call(this, event, d), event, d, "mouse");
    if (!gesture) return;
    select_default2(event.view).on("mousemove.drag", mousemoved, nonpassivecapture).on("mouseup.drag", mouseupped, nonpassivecapture);
    nodrag_default(event.view);
    nopropagation(event);
    mousemoving = false;
    mousedownx = event.clientX;
    mousedowny = event.clientY;
    gesture("start", event);
  }
  function mousemoved(event) {
    noevent_default(event);
    if (!mousemoving) {
      var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
      mousemoving = dx * dx + dy * dy > clickDistance2;
    }
    gestures.mouse("drag", event);
  }
  function mouseupped(event) {
    select_default2(event.view).on("mousemove.drag mouseup.drag", null);
    yesdrag(event.view, mousemoving);
    noevent_default(event);
    gestures.mouse("end", event);
  }
  function touchstarted(event, d) {
    if (!filter2.call(this, event, d)) return;
    var touches = event.changedTouches, c = container.call(this, event, d), n = touches.length, i, gesture;
    for (i = 0; i < n; ++i) {
      if (gesture = beforestart(this, c, event, d, touches[i].identifier, touches[i])) {
        nopropagation(event);
        gesture("start", event, touches[i]);
      }
    }
  }
  function touchmoved(event) {
    var touches = event.changedTouches, n = touches.length, i, gesture;
    for (i = 0; i < n; ++i) {
      if (gesture = gestures[touches[i].identifier]) {
        noevent_default(event);
        gesture("drag", event, touches[i]);
      }
    }
  }
  function touchended(event) {
    var touches = event.changedTouches, n = touches.length, i, gesture;
    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() {
      touchending = null;
    }, 500);
    for (i = 0; i < n; ++i) {
      if (gesture = gestures[touches[i].identifier]) {
        nopropagation(event);
        gesture("end", event, touches[i]);
      }
    }
  }
  function beforestart(that, container2, event, d, identifier, touch) {
    var dispatch2 = listeners.copy(), p = pointer_default(touch || event, container2), dx, dy, s;
    if ((s = subject.call(that, new DragEvent("beforestart", {
      sourceEvent: event,
      target: drag,
      identifier,
      active,
      x: p[0],
      y: p[1],
      dx: 0,
      dy: 0,
      dispatch: dispatch2
    }), d)) == null) return;
    dx = s.x - p[0] || 0;
    dy = s.y - p[1] || 0;
    return function gesture(type, event2, touch2) {
      var p0 = p, n;
      switch (type) {
        case "start":
          gestures[identifier] = gesture, n = active++;
          break;
        case "end":
          delete gestures[identifier], --active;
        // falls through
        case "drag":
          p = pointer_default(touch2 || event2, container2), n = active;
          break;
      }
      dispatch2.call(
        type,
        that,
        new DragEvent(type, {
          sourceEvent: event2,
          subject: s,
          target: drag,
          identifier,
          active: n,
          x: p[0] + dx,
          y: p[1] + dy,
          dx: p[0] - p0[0],
          dy: p[1] - p0[1],
          dispatch: dispatch2
        }),
        d
      );
    };
  }
  drag.filter = function(_) {
    return arguments.length ? (filter2 = typeof _ === "function" ? _ : constant_default2(!!_), drag) : filter2;
  };
  drag.container = function(_) {
    return arguments.length ? (container = typeof _ === "function" ? _ : constant_default2(_), drag) : container;
  };
  drag.subject = function(_) {
    return arguments.length ? (subject = typeof _ === "function" ? _ : constant_default2(_), drag) : subject;
  };
  drag.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default2(!!_), drag) : touchable;
  };
  drag.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? drag : value;
  };
  drag.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
  };
  return drag;
}

// node_modules/d3-color/src/define.js
function define_default(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}
function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

// node_modules/d3-color/src/color.js
function Color() {
}
var darker = 0.7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
define_default(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});
function color_formatHex() {
  return this.rgb().formatHex();
}
function color_formatHex8() {
  return this.rgb().formatHex8();
}
function color_formatHsl() {
  return hslConvert(this).formatHsl();
}
function color_formatRgb() {
  return this.rgb().formatRgb();
}
function color(format) {
  var m, l;
  format = (format + "").trim().toLowerCase();
  return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format) ? rgbn(named[format]) : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n) {
  return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}
function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb();
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}
function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}
function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}
define_default(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));
function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}
function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}
function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl();
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255, g = o.g / 255, b = o.b / 255, min = Math.min(r, g, b), max = Math.max(r, g, b), h = NaN, s = max - min, l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}
function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}
function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}
define_default(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < 0.5 ? l : 1 - l) * s, m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));
function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}
function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}

// node_modules/d3-interpolate/src/basis.js
function basis(t1, v0, v1, v2, v3) {
  var t2 = t1 * t1, t3 = t2 * t1;
  return ((1 - 3 * t1 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
}
function basis_default(values) {
  var n = values.length - 1;
  return function(t) {
    var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/basisClosed.js
function basisClosed_default(values) {
  var n = values.length;
  return function(t) {
    var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/constant.js
var constant_default3 = (x) => () => x;

// node_modules/d3-interpolate/src/color.js
function linear(a, d) {
  return function(t) {
    return a + t * d;
  };
}
function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}
function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant_default3(isNaN(a) ? b : a);
  };
}
function nogamma(a, b) {
  var d = b - a;
  return d ? linear(a, d) : constant_default3(isNaN(a) ? b : a);
}

// node_modules/d3-interpolate/src/rgb.js
var rgb_default = (function rgbGamma(y) {
  var color2 = gamma(y);
  function rgb2(start2, end) {
    var r = color2((start2 = rgb(start2)).r, (end = rgb(end)).r), g = color2(start2.g, end.g), b = color2(start2.b, end.b), opacity = nogamma(start2.opacity, end.opacity);
    return function(t) {
      start2.r = r(t);
      start2.g = g(t);
      start2.b = b(t);
      start2.opacity = opacity(t);
      return start2 + "";
    };
  }
  rgb2.gamma = rgbGamma;
  return rgb2;
})(1);
function rgbSpline(spline) {
  return function(colors) {
    var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color2;
    for (i = 0; i < n; ++i) {
      color2 = rgb(colors[i]);
      r[i] = color2.r || 0;
      g[i] = color2.g || 0;
      b[i] = color2.b || 0;
    }
    r = spline(r);
    g = spline(g);
    b = spline(b);
    color2.opacity = 1;
    return function(t) {
      color2.r = r(t);
      color2.g = g(t);
      color2.b = b(t);
      return color2 + "";
    };
  };
}
var rgbBasis = rgbSpline(basis_default);
var rgbBasisClosed = rgbSpline(basisClosed_default);

// node_modules/d3-interpolate/src/numberArray.js
function numberArray_default(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0, c = b.slice(), i;
  return function(t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
    return c;
  };
}
function isNumberArray(x) {
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

// node_modules/d3-interpolate/src/array.js
function genericArray(a, b) {
  var nb = b ? b.length : 0, na = a ? Math.min(nb, a.length) : 0, x = new Array(na), c = new Array(nb), i;
  for (i = 0; i < na; ++i) x[i] = value_default(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];
  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);
    return c;
  };
}

// node_modules/d3-interpolate/src/date.js
function date_default(a, b) {
  var d = /* @__PURE__ */ new Date();
  return a = +a, b = +b, function(t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

// node_modules/d3-interpolate/src/number.js
function number_default(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}

// node_modules/d3-interpolate/src/object.js
function object_default(a, b) {
  var i = {}, c = {}, k;
  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};
  for (k in b) {
    if (k in a) {
      i[k] = value_default(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }
  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

// node_modules/d3-interpolate/src/string.js
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero(b) {
  return function() {
    return b;
  };
}
function one(b) {
  return function(t) {
    return b(t) + "";
  };
}
function string_default(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
  a = a + "", b = b + "";
  while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) {
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs;
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) {
      if (s[i]) s[i] += bm;
      else s[++i] = bm;
    } else {
      s[++i] = null;
      q.push({ i, x: number_default(am, bm) });
    }
    bi = reB.lastIndex;
  }
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs;
    else s[++i] = bs;
  }
  return s.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function(t) {
    for (var i2 = 0, o; i2 < b; ++i2) s[(o = q[i2]).i] = o.x(t);
    return s.join("");
  });
}

// node_modules/d3-interpolate/src/value.js
function value_default(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant_default3(b) : (t === "number" ? number_default : t === "string" ? (c = color(b)) ? (b = c, rgb_default) : string_default : b instanceof color ? rgb_default : b instanceof Date ? date_default : isNumberArray(b) ? numberArray_default : Array.isArray(b) ? genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object_default : number_default)(a, b);
}

// node_modules/d3-interpolate/src/transform/decompose.js
var degrees = 180 / Math.PI;
var identity = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function decompose_default(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX,
    scaleY
  };
}

// node_modules/d3-interpolate/src/transform/parse.js
var svgNode;
function parseCss(value) {
  const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m.isIdentity ? identity : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
}
function parseSvg(value) {
  if (value == null) return identity;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity;
  value = value.matrix;
  return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
}

// node_modules/d3-interpolate/src/transform/index.js
function interpolateTransform(parse, pxComma, pxParen, degParen) {
  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }
  function translate(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }
  function rotate(a, b, s, q) {
    if (a !== b) {
      if (a - b > 180) b += 360;
      else if (b - a > 180) a += 360;
      q.push({ i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number_default(a, b) });
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }
  function skewX(a, b, s, q) {
    if (a !== b) {
      q.push({ i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number_default(a, b) });
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }
  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }
  return function(a, b) {
    var s = [], q = [];
    a = parse(a), b = parse(b);
    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skewX(a.skewX, b.skewX, s, q);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
    a = b = null;
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

// node_modules/d3-interpolate/src/zoom.js
var epsilon2 = 1e-12;
function cosh(x) {
  return ((x = Math.exp(x)) + 1 / x) / 2;
}
function sinh(x) {
  return ((x = Math.exp(x)) - 1 / x) / 2;
}
function tanh(x) {
  return ((x = Math.exp(2 * x)) - 1) / (x + 1);
}
var zoom_default = (function zoomRho(rho, rho2, rho4) {
  function zoom(p0, p1) {
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2], dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, i, S;
    if (d2 < epsilon2) {
      S = Math.log(w1 / w0) / rho;
      i = function(t) {
        return [
          ux0 + t * dx,
          uy0 + t * dy,
          w0 * Math.exp(rho * t * S)
        ];
      };
    } else {
      var d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1), r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      i = function(t) {
        var s = t * S, coshr0 = cosh(r0), u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
        return [
          ux0 + u * dx,
          uy0 + u * dy,
          w0 * coshr0 / cosh(rho * s + r0)
        ];
      };
    }
    i.duration = S * 1e3 * rho / Math.SQRT2;
    return i;
  }
  zoom.rho = function(_) {
    var _1 = Math.max(1e-3, +_), _2 = _1 * _1, _4 = _2 * _2;
    return zoomRho(_1, _2, _4);
  };
  return zoom;
})(Math.SQRT2, 2, 4);

// node_modules/d3-timer/src/timer.js
var frame = 0;
var timeout = 0;
var interval = 0;
var pokeDelay = 1e3;
var taskHead;
var taskTail;
var clockLast = 0;
var clockNow = 0;
var clockSkew = 0;
var clock = typeof performance === "object" && performance.now ? performance : Date;
var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
  setTimeout(f, 17);
};
function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
  clockNow = 0;
}
function Timer() {
  this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};
function timer(callback, delay, time) {
  var t = new Timer();
  t.restart(callback, delay, time);
  return t;
}
function timerFlush() {
  now();
  ++frame;
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
    t = t._next;
  }
  --frame;
}
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
function poke() {
  var now2 = clock.now(), delay = now2 - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
}
function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}
function sleep(time) {
  if (frame) return;
  if (timeout) timeout = clearTimeout(timeout);
  var delay = time - clockNow;
  if (delay > 24) {
    if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

// node_modules/d3-timer/src/timeout.js
function timeout_default(callback, delay, time) {
  var t = new Timer();
  delay = delay == null ? 0 : +delay;
  t.restart((elapsed) => {
    t.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t;
}

// node_modules/d3-transition/src/transition/schedule.js
var emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
var emptyTween = [];
var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;
function schedule_default(node, name2, id2, index2, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id2 in schedules) return;
  create(node, id2, {
    name: name2,
    index: index2,
    // For context during callback.
    group,
    // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}
function init(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}
function set2(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > STARTED) throw new Error("too late; already running");
  return schedule;
}
function get2(node, id2) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id2])) throw new Error("transition not found");
  return schedule;
}
function create(node, id2, self) {
  var schedules = node.__transition, tween;
  schedules[id2] = self;
  self.timer = timer(schedule, 0, self.time);
  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start2, self.delay, self.time);
    if (self.delay <= elapsed) start2(elapsed - self.delay);
  }
  function start2(elapsed) {
    var i, j, n, o;
    if (self.state !== SCHEDULED) return stop();
    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;
      if (o.state === STARTED) return timeout_default(start2);
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      } else if (+i < id2) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("cancel", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }
    }
    timeout_default(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return;
    self.state = STARTED;
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }
  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i = -1, n = tween.length;
    while (++i < n) {
      tween[i].call(node, t);
    }
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }
  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id2];
    for (var i in schedules) return;
    delete node.__transition;
  }
}

// node_modules/d3-transition/src/interrupt.js
function interrupt_default(node, name2) {
  var schedules = node.__transition, schedule, active, empty2 = true, i;
  if (!schedules) return;
  name2 = name2 == null ? null : name2 + "";
  for (i in schedules) {
    if ((schedule = schedules[i]).name !== name2) {
      empty2 = false;
      continue;
    }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i];
  }
  if (empty2) delete node.__transition;
}

// node_modules/d3-transition/src/selection/interrupt.js
function interrupt_default2(name2) {
  return this.each(function() {
    interrupt_default(this, name2);
  });
}

// node_modules/d3-transition/src/transition/tween.js
function tweenRemove(id2, name2) {
  var tween0, tween1;
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name2) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }
    schedule.tween = tween1;
  };
}
function tweenFunction(id2, name2, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error();
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = { name: name2, value }, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name2) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }
    schedule.tween = tween1;
  };
}
function tween_default(name2, value) {
  var id2 = this._id;
  name2 += "";
  if (arguments.length < 2) {
    var tween = get2(this.node(), id2).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name2) {
        return t.value;
      }
    }
    return null;
  }
  return this.each((value == null ? tweenRemove : tweenFunction)(id2, name2, value));
}
function tweenValue(transition2, name2, value) {
  var id2 = transition2._id;
  transition2.each(function() {
    var schedule = set2(this, id2);
    (schedule.value || (schedule.value = {}))[name2] = value.apply(this, arguments);
  });
  return function(node) {
    return get2(node, id2).value[name2];
  };
}

// node_modules/d3-transition/src/transition/interpolate.js
function interpolate_default(a, b) {
  var c;
  return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c = color(b)) ? (b = c, rgb_default) : string_default)(a, b);
}

// node_modules/d3-transition/src/transition/attr.js
function attrRemove2(name2) {
  return function() {
    this.removeAttribute(name2);
  };
}
function attrRemoveNS2(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant2(name2, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttribute(name2);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrConstantNS2(fullname, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrFunction2(name2, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name2);
    string0 = this.getAttribute(name2);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attrFunctionNS2(fullname, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attr_default2(name2, value) {
  var fullname = namespace_default(name2), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
  return this.attrTween(name2, typeof value === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i, tweenValue(this, "attr." + name2, value)) : value == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i, value));
}

// node_modules/d3-transition/src/transition/attrTween.js
function attrInterpolate(name2, i) {
  return function(t) {
    this.setAttribute(name2, i.call(this, t));
  };
}
function attrInterpolateNS(fullname, i) {
  return function(t) {
    this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
  };
}
function attrTweenNS(fullname, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
    return t0;
  }
  tween._value = value;
  return tween;
}
function attrTween(name2, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolate(name2, i);
    return t0;
  }
  tween._value = value;
  return tween;
}
function attrTween_default(name2, value) {
  var key = "attr." + name2;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  var fullname = namespace_default(name2);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

// node_modules/d3-transition/src/transition/delay.js
function delayFunction(id2, value) {
  return function() {
    init(this, id2).delay = +value.apply(this, arguments);
  };
}
function delayConstant(id2, value) {
  return value = +value, function() {
    init(this, id2).delay = value;
  };
}
function delay_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id2, value)) : get2(this.node(), id2).delay;
}

// node_modules/d3-transition/src/transition/duration.js
function durationFunction(id2, value) {
  return function() {
    set2(this, id2).duration = +value.apply(this, arguments);
  };
}
function durationConstant(id2, value) {
  return value = +value, function() {
    set2(this, id2).duration = value;
  };
}
function duration_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id2, value)) : get2(this.node(), id2).duration;
}

// node_modules/d3-transition/src/transition/ease.js
function easeConstant(id2, value) {
  if (typeof value !== "function") throw new Error();
  return function() {
    set2(this, id2).ease = value;
  };
}
function ease_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each(easeConstant(id2, value)) : get2(this.node(), id2).ease;
}

// node_modules/d3-transition/src/transition/easeVarying.js
function easeVarying(id2, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (typeof v !== "function") throw new Error();
    set2(this, id2).ease = v;
  };
}
function easeVarying_default(value) {
  if (typeof value !== "function") throw new Error();
  return this.each(easeVarying(this._id, value));
}

// node_modules/d3-transition/src/transition/filter.js
function filter_default2(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Transition(subgroups, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/merge.js
function merge_default2(transition2) {
  if (transition2._id !== this._id) throw new Error();
  for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Transition(merges, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/on.js
function start(name2) {
  return (name2 + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}
function onFunction(id2, name2, listener) {
  var on0, on1, sit = start(name2) ? init : set2;
  return function() {
    var schedule = sit(this, id2), on = schedule.on;
    if (on !== on0) (on1 = (on0 = on).copy()).on(name2, listener);
    schedule.on = on1;
  };
}
function on_default2(name2, listener) {
  var id2 = this._id;
  return arguments.length < 2 ? get2(this.node(), id2).on.on(name2) : this.each(onFunction(id2, name2, listener));
}

// node_modules/d3-transition/src/transition/remove.js
function removeFunction(id2) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id2) return;
    if (parent) parent.removeChild(this);
  };
}
function remove_default2() {
  return this.on("end.remove", removeFunction(this._id));
}

// node_modules/d3-transition/src/transition/select.js
function select_default3(select) {
  var name2 = this._name, id2 = this._id;
  if (typeof select !== "function") select = selector_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule_default(subgroup[i], name2, id2, i, subgroup, get2(node, id2));
      }
    }
  }
  return new Transition(subgroups, this._parents, name2, id2);
}

// node_modules/d3-transition/src/transition/selectAll.js
function selectAll_default2(select) {
  var name2 = this._name, id2 = this._id;
  if (typeof select !== "function") select = selectorAll_default(select);
  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        for (var children2 = select.call(node, node.__data__, i, group), child, inherit2 = get2(node, id2), k = 0, l = children2.length; k < l; ++k) {
          if (child = children2[k]) {
            schedule_default(child, name2, id2, k, children2, inherit2);
          }
        }
        subgroups.push(children2);
        parents.push(node);
      }
    }
  }
  return new Transition(subgroups, parents, name2, id2);
}

// node_modules/d3-transition/src/transition/selection.js
var Selection2 = selection_default.prototype.constructor;
function selection_default2() {
  return new Selection2(this._groups, this._parents);
}

// node_modules/d3-transition/src/transition/style.js
function styleNull(name2, interpolate) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name2), string1 = (this.style.removeProperty(name2), styleValue(this, name2));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}
function styleRemove2(name2) {
  return function() {
    this.style.removeProperty(name2);
  };
}
function styleConstant2(name2, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = styleValue(this, name2);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function styleFunction2(name2, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name2), value1 = value(this), string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name2), styleValue(this, name2));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function styleMaybeRemove(id2, name2) {
  var on0, on1, listener0, key = "style." + name2, event = "end." + key, remove2;
  return function() {
    var schedule = set2(this, id2), on = schedule.on, listener = schedule.value[key] == null ? remove2 || (remove2 = styleRemove2(name2)) : void 0;
    if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
    schedule.on = on1;
  };
}
function style_default2(name2, value, priority) {
  var i = (name2 += "") === "transform" ? interpolateTransformCss : interpolate_default;
  return value == null ? this.styleTween(name2, styleNull(name2, i)).on("end.style." + name2, styleRemove2(name2)) : typeof value === "function" ? this.styleTween(name2, styleFunction2(name2, i, tweenValue(this, "style." + name2, value))).each(styleMaybeRemove(this._id, name2)) : this.styleTween(name2, styleConstant2(name2, i, value), priority).on("end.style." + name2, null);
}

// node_modules/d3-transition/src/transition/styleTween.js
function styleInterpolate(name2, i, priority) {
  return function(t) {
    this.style.setProperty(name2, i.call(this, t), priority);
  };
}
function styleTween(name2, value, priority) {
  var t, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t = (i0 = i) && styleInterpolate(name2, i, priority);
    return t;
  }
  tween._value = value;
  return tween;
}
function styleTween_default(name2, value, priority) {
  var key = "style." + (name2 += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, styleTween(name2, value, priority == null ? "" : priority));
}

// node_modules/d3-transition/src/transition/text.js
function textConstant2(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction2(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}
function text_default2(value) {
  return this.tween("text", typeof value === "function" ? textFunction2(tweenValue(this, "text", value)) : textConstant2(value == null ? "" : value + ""));
}

// node_modules/d3-transition/src/transition/textTween.js
function textInterpolate(i) {
  return function(t) {
    this.textContent = i.call(this, t);
  };
}
function textTween(value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
    return t0;
  }
  tween._value = value;
  return tween;
}
function textTween_default(value) {
  var key = "text";
  if (arguments.length < 1) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, textTween(value));
}

// node_modules/d3-transition/src/transition/transition.js
function transition_default() {
  var name2 = this._name, id0 = this._id, id1 = newId();
  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        var inherit2 = get2(node, id0);
        schedule_default(node, name2, id1, i, group, {
          time: inherit2.time + inherit2.delay + inherit2.duration,
          delay: 0,
          duration: inherit2.duration,
          ease: inherit2.ease
        });
      }
    }
  }
  return new Transition(groups, this._parents, name2, id1);
}

// node_modules/d3-transition/src/transition/end.js
function end_default() {
  var on0, on1, that = this, id2 = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = { value: reject }, end = { value: function() {
      if (--size === 0) resolve();
    } };
    that.each(function() {
      var schedule = set2(this, id2), on = schedule.on;
      if (on !== on0) {
        on1 = (on0 = on).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }
      schedule.on = on1;
    });
    if (size === 0) resolve();
  });
}

// node_modules/d3-transition/src/transition/index.js
var id = 0;
function Transition(groups, parents, name2, id2) {
  this._groups = groups;
  this._parents = parents;
  this._name = name2;
  this._id = id2;
}
function transition(name2) {
  return selection_default().transition(name2);
}
function newId() {
  return ++id;
}
var selection_prototype = selection_default.prototype;
Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: select_default3,
  selectAll: selectAll_default2,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: filter_default2,
  merge: merge_default2,
  selection: selection_default2,
  transition: transition_default,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: on_default2,
  attr: attr_default2,
  attrTween: attrTween_default,
  style: style_default2,
  styleTween: styleTween_default,
  text: text_default2,
  textTween: textTween_default,
  remove: remove_default2,
  tween: tween_default,
  delay: delay_default,
  duration: duration_default,
  ease: ease_default,
  easeVarying: easeVarying_default,
  end: end_default,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};

// node_modules/d3-ease/src/cubic.js
function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

// node_modules/d3-transition/src/selection/transition.js
var defaultTiming = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};
function inherit(node, id2) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id2])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id2} not found`);
    }
  }
  return timing;
}
function transition_default2(name2) {
  var id2, timing;
  if (name2 instanceof Transition) {
    id2 = name2._id, name2 = name2._name;
  } else {
    id2 = newId(), (timing = defaultTiming).time = now(), name2 = name2 == null ? null : name2 + "";
  }
  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        schedule_default(node, name2, id2, i, group, timing || inherit(node, id2));
      }
    }
  }
  return new Transition(groups, this._parents, name2, id2);
}

// node_modules/d3-transition/src/selection/index.js
selection_default.prototype.interrupt = interrupt_default2;
selection_default.prototype.transition = transition_default2;

// node_modules/d3-zoom/src/constant.js
var constant_default4 = (x) => () => x;

// node_modules/d3-zoom/src/event.js
function ZoomEvent(type, {
  sourceEvent,
  target,
  transform: transform2,
  dispatch: dispatch2
}) {
  Object.defineProperties(this, {
    type: { value: type, enumerable: true, configurable: true },
    sourceEvent: { value: sourceEvent, enumerable: true, configurable: true },
    target: { value: target, enumerable: true, configurable: true },
    transform: { value: transform2, enumerable: true, configurable: true },
    _: { value: dispatch2 }
  });
}

// node_modules/d3-zoom/src/transform.js
function Transform(k, x, y) {
  this.k = k;
  this.x = x;
  this.y = y;
}
Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  },
  translate: function(x, y) {
    return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
  },
  apply: function(point) {
    return [point[0] * this.k + this.x, point[1] * this.k + this.y];
  },
  applyX: function(x) {
    return x * this.k + this.x;
  },
  applyY: function(y) {
    return y * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x) {
    return (x - this.x) / this.k;
  },
  invertY: function(y) {
    return (y - this.y) / this.k;
  },
  rescaleX: function(x) {
    return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
  },
  rescaleY: function(y) {
    return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var identity2 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
  while (!node.__zoom) if (!(node = node.parentNode)) return identity2;
  return node.__zoom;
}

// node_modules/d3-zoom/src/noevent.js
function nopropagation2(event) {
  event.stopImmediatePropagation();
}
function noevent_default2(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

// node_modules/d3-zoom/src/zoom.js
function defaultFilter2(event) {
  return (!event.ctrlKey || event.type === "wheel") && !event.button;
}
function defaultExtent() {
  var e = this;
  if (e instanceof SVGElement) {
    e = e.ownerSVGElement || e;
    if (e.hasAttribute("viewBox")) {
      e = e.viewBox.baseVal;
      return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
    }
    return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
  }
  return [[0, 0], [e.clientWidth, e.clientHeight]];
}
function defaultTransform() {
  return this.__zoom || identity2;
}
function defaultWheelDelta(event) {
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 2e-3) * (event.ctrlKey ? 10 : 1);
}
function defaultTouchable2() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function defaultConstrain(transform2, extent, translateExtent) {
  var dx0 = transform2.invertX(extent[0][0]) - translateExtent[0][0], dx1 = transform2.invertX(extent[1][0]) - translateExtent[1][0], dy0 = transform2.invertY(extent[0][1]) - translateExtent[0][1], dy1 = transform2.invertY(extent[1][1]) - translateExtent[1][1];
  return transform2.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}
function zoom_default2() {
  var filter2 = defaultFilter2, extent = defaultExtent, constrain = defaultConstrain, wheelDelta2 = defaultWheelDelta, touchable = defaultTouchable2, scaleExtent = [0, Infinity], translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]], duration = 250, interpolate = zoom_default, listeners = dispatch_default("start", "zoom", "end"), touchstarting, touchfirst, touchending, touchDelay = 500, wheelDelay = 150, clickDistance2 = 0, tapDistance = 10;
  function zoom(selection2) {
    selection2.property("__zoom", defaultTransform).on("wheel.zoom", wheeled, { passive: false }).on("mousedown.zoom", mousedowned).on("dblclick.zoom", dblclicked).filter(touchable).on("touchstart.zoom", touchstarted).on("touchmove.zoom", touchmoved).on("touchend.zoom touchcancel.zoom", touchended).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  zoom.transform = function(collection, transform2, point, event) {
    var selection2 = collection.selection ? collection.selection() : collection;
    selection2.property("__zoom", defaultTransform);
    if (collection !== selection2) {
      schedule(collection, transform2, point, event);
    } else {
      selection2.interrupt().each(function() {
        gesture(this, arguments).event(event).start().zoom(null, typeof transform2 === "function" ? transform2.apply(this, arguments) : transform2).end();
      });
    }
  };
  zoom.scaleBy = function(selection2, k, p, event) {
    zoom.scaleTo(selection2, function() {
      var k0 = this.__zoom.k, k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return k0 * k1;
    }, p, event);
  };
  zoom.scaleTo = function(selection2, k, p, event) {
    zoom.transform(selection2, function() {
      var e = extent.apply(this, arguments), t0 = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p, p1 = t0.invert(p0), k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
    }, p, event);
  };
  zoom.translateBy = function(selection2, x, y, event) {
    zoom.transform(selection2, function() {
      return constrain(this.__zoom.translate(
        typeof x === "function" ? x.apply(this, arguments) : x,
        typeof y === "function" ? y.apply(this, arguments) : y
      ), extent.apply(this, arguments), translateExtent);
    }, null, event);
  };
  zoom.translateTo = function(selection2, x, y, p, event) {
    zoom.transform(selection2, function() {
      var e = extent.apply(this, arguments), t = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
      return constrain(identity2.translate(p0[0], p0[1]).scale(t.k).translate(
        typeof x === "function" ? -x.apply(this, arguments) : -x,
        typeof y === "function" ? -y.apply(this, arguments) : -y
      ), e, translateExtent);
    }, p, event);
  };
  function scale(transform2, k) {
    k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
    return k === transform2.k ? transform2 : new Transform(k, transform2.x, transform2.y);
  }
  function translate(transform2, p0, p1) {
    var x = p0[0] - p1[0] * transform2.k, y = p0[1] - p1[1] * transform2.k;
    return x === transform2.x && y === transform2.y ? transform2 : new Transform(transform2.k, x, y);
  }
  function centroid(extent2) {
    return [(+extent2[0][0] + +extent2[1][0]) / 2, (+extent2[0][1] + +extent2[1][1]) / 2];
  }
  function schedule(transition2, transform2, point, event) {
    transition2.on("start.zoom", function() {
      gesture(this, arguments).event(event).start();
    }).on("interrupt.zoom end.zoom", function() {
      gesture(this, arguments).event(event).end();
    }).tween("zoom", function() {
      var that = this, args = arguments, g = gesture(that, args).event(event), e = extent.apply(that, args), p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point, w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]), a = that.__zoom, b = typeof transform2 === "function" ? transform2.apply(that, args) : transform2, i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
      return function(t) {
        if (t === 1) t = b;
        else {
          var l = i(t), k = w / l[2];
          t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k);
        }
        g.zoom(null, t);
      };
    });
  }
  function gesture(that, args, clean) {
    return !clean && that.__zooming || new Gesture(that, args);
  }
  function Gesture(that, args) {
    this.that = that;
    this.args = args;
    this.active = 0;
    this.sourceEvent = null;
    this.extent = extent.apply(that, args);
    this.taps = 0;
  }
  Gesture.prototype = {
    event: function(event) {
      if (event) this.sourceEvent = event;
      return this;
    },
    start: function() {
      if (++this.active === 1) {
        this.that.__zooming = this;
        this.emit("start");
      }
      return this;
    },
    zoom: function(key, transform2) {
      if (this.mouse && key !== "mouse") this.mouse[1] = transform2.invert(this.mouse[0]);
      if (this.touch0 && key !== "touch") this.touch0[1] = transform2.invert(this.touch0[0]);
      if (this.touch1 && key !== "touch") this.touch1[1] = transform2.invert(this.touch1[0]);
      this.that.__zoom = transform2;
      this.emit("zoom");
      return this;
    },
    end: function() {
      if (--this.active === 0) {
        delete this.that.__zooming;
        this.emit("end");
      }
      return this;
    },
    emit: function(type) {
      var d = select_default2(this.that).datum();
      listeners.call(
        type,
        this.that,
        new ZoomEvent(type, {
          sourceEvent: this.sourceEvent,
          target: zoom,
          type,
          transform: this.that.__zoom,
          dispatch: listeners
        }),
        d
      );
    }
  };
  function wheeled(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var g = gesture(this, args).event(event), t = this.__zoom, k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta2.apply(this, arguments)))), p = pointer_default(event);
    if (g.wheel) {
      if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) {
        g.mouse[1] = t.invert(g.mouse[0] = p);
      }
      clearTimeout(g.wheel);
    } else if (t.k === k) return;
    else {
      g.mouse = [p, t.invert(p)];
      interrupt_default(this);
      g.start();
    }
    noevent_default2(event);
    g.wheel = setTimeout(wheelidled, wheelDelay);
    g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));
    function wheelidled() {
      g.wheel = null;
      g.end();
    }
  }
  function mousedowned(event, ...args) {
    if (touchending || !filter2.apply(this, arguments)) return;
    var currentTarget = event.currentTarget, g = gesture(this, args, true).event(event), v = select_default2(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true), p = pointer_default(event, currentTarget), x0 = event.clientX, y0 = event.clientY;
    nodrag_default(event.view);
    nopropagation2(event);
    g.mouse = [p, this.__zoom.invert(p)];
    interrupt_default(this);
    g.start();
    function mousemoved(event2) {
      noevent_default2(event2);
      if (!g.moved) {
        var dx = event2.clientX - x0, dy = event2.clientY - y0;
        g.moved = dx * dx + dy * dy > clickDistance2;
      }
      g.event(event2).zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = pointer_default(event2, currentTarget), g.mouse[1]), g.extent, translateExtent));
    }
    function mouseupped(event2) {
      v.on("mousemove.zoom mouseup.zoom", null);
      yesdrag(event2.view, g.moved);
      noevent_default2(event2);
      g.event(event2).end();
    }
  }
  function dblclicked(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var t0 = this.__zoom, p0 = pointer_default(event.changedTouches ? event.changedTouches[0] : event, this), p1 = t0.invert(p0), k1 = t0.k * (event.shiftKey ? 0.5 : 2), t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, args), translateExtent);
    noevent_default2(event);
    if (duration > 0) select_default2(this).transition().duration(duration).call(schedule, t1, p0, event);
    else select_default2(this).call(zoom.transform, t1, p0, event);
  }
  function touchstarted(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var touches = event.touches, n = touches.length, g = gesture(this, args, event.changedTouches.length === n).event(event), started, i, t, p;
    nopropagation2(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer_default(t, this);
      p = [p, this.__zoom.invert(p), t.identifier];
      if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
      else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
    }
    if (touchstarting) touchstarting = clearTimeout(touchstarting);
    if (started) {
      if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() {
        touchstarting = null;
      }, touchDelay);
      interrupt_default(this);
      g.start();
    }
  }
  function touchmoved(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t, p, l;
    noevent_default2(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer_default(t, this);
      if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
      else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
    }
    t = g.that.__zoom;
    if (g.touch1) {
      var p0 = g.touch0[0], l0 = g.touch0[1], p1 = g.touch1[0], l1 = g.touch1[1], dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp, dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
      t = scale(t, Math.sqrt(dp / dl));
      p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
    } else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
    else return;
    g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
  }
  function touchended(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t;
    nopropagation2(event);
    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() {
      touchending = null;
    }, touchDelay);
    for (i = 0; i < n; ++i) {
      t = touches[i];
      if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
      else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
    }
    if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
    if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
    else {
      g.end();
      if (g.taps === 2) {
        t = pointer_default(t, this);
        if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
          var p = select_default2(this).on("dblclick.zoom");
          if (p) p.apply(this, arguments);
        }
      }
    }
  }
  zoom.wheelDelta = function(_) {
    return arguments.length ? (wheelDelta2 = typeof _ === "function" ? _ : constant_default4(+_), zoom) : wheelDelta2;
  };
  zoom.filter = function(_) {
    return arguments.length ? (filter2 = typeof _ === "function" ? _ : constant_default4(!!_), zoom) : filter2;
  };
  zoom.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default4(!!_), zoom) : touchable;
  };
  zoom.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant_default4([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
  };
  zoom.scaleExtent = function(_) {
    return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
  };
  zoom.translateExtent = function(_) {
    return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
  };
  zoom.constrain = function(_) {
    return arguments.length ? (constrain = _, zoom) : constrain;
  };
  zoom.duration = function(_) {
    return arguments.length ? (duration = +_, zoom) : duration;
  };
  zoom.interpolate = function(_) {
    return arguments.length ? (interpolate = _, zoom) : interpolate;
  };
  zoom.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? zoom : value;
  };
  zoom.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
  };
  zoom.tapDistance = function(_) {
    return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
  };
  return zoom;
}

// node_modules/@xyflow/system/dist/esm/index.js
var errorMessages = {
  error001: () => "[React Flow]: Seems like you have not used zustand provider as an ancestor. Help: https://reactflow.dev/error#001",
  error002: () => "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
  error003: (nodeType) => `Node type "${nodeType}" not found. Using fallback type "default".`,
  error004: () => "The React Flow parent container needs a width and a height to render the graph.",
  error005: () => "Only child nodes can use a parent extent.",
  error006: () => "Can't create edge. An edge needs a source and a target.",
  error007: (id2) => `The old edge with id=${id2} does not exist.`,
  error009: (type) => `Marker type "${type}" doesn't exist.`,
  error008: (handleType, { id: id2, sourceHandle, targetHandle }) => `Couldn't create edge for ${handleType} handle id: "${handleType === "source" ? sourceHandle : targetHandle}", edge id: ${id2}.`,
  error010: () => "Handle: No node id found. Make sure to only use a Handle inside a custom Node.",
  error011: (edgeType) => `Edge type "${edgeType}" not found. Using fallback type "default".`,
  error012: (id2) => `Node with id "${id2}" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.`,
  error013: (lib = "react") => `It seems that you haven't loaded the styles. Please import '@xyflow/${lib}/dist/style.css' or base.css to make sure everything is working properly.`,
  error014: () => "useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.",
  error015: () => "It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs."
};
var infiniteExtent = [
  [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
];
var elementSelectionKeys = ["Enter", " ", "Escape"];
var defaultAriaLabelConfig = {
  "node.a11yDescription.default": "Press enter or space to select a node. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.ariaLiveMessage": ({ direction, x, y }) => `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
  "edge.a11yDescription.default": "Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.",
  // Control elements
  "controls.ariaLabel": "Control Panel",
  "controls.zoomIn.ariaLabel": "Zoom In",
  "controls.zoomOut.ariaLabel": "Zoom Out",
  "controls.fitView.ariaLabel": "Fit View",
  "controls.interactive.ariaLabel": "Toggle Interactivity",
  // Mini map
  "minimap.ariaLabel": "Mini Map",
  // Handle
  "handle.ariaLabel": "Handle"
};
var ConnectionMode;
(function(ConnectionMode2) {
  ConnectionMode2["Strict"] = "strict";
  ConnectionMode2["Loose"] = "loose";
})(ConnectionMode || (ConnectionMode = {}));
var PanOnScrollMode;
(function(PanOnScrollMode2) {
  PanOnScrollMode2["Free"] = "free";
  PanOnScrollMode2["Vertical"] = "vertical";
  PanOnScrollMode2["Horizontal"] = "horizontal";
})(PanOnScrollMode || (PanOnScrollMode = {}));
var SelectionMode;
(function(SelectionMode2) {
  SelectionMode2["Partial"] = "partial";
  SelectionMode2["Full"] = "full";
})(SelectionMode || (SelectionMode = {}));
var initialConnection = {
  inProgress: false,
  isValid: null,
  from: null,
  fromHandle: null,
  fromPosition: null,
  fromNode: null,
  to: null,
  toHandle: null,
  toPosition: null,
  toNode: null,
  pointer: null
};
var ConnectionLineType;
(function(ConnectionLineType2) {
  ConnectionLineType2["Bezier"] = "default";
  ConnectionLineType2["Straight"] = "straight";
  ConnectionLineType2["Step"] = "step";
  ConnectionLineType2["SmoothStep"] = "smoothstep";
  ConnectionLineType2["SimpleBezier"] = "simplebezier";
})(ConnectionLineType || (ConnectionLineType = {}));
var MarkerType;
(function(MarkerType2) {
  MarkerType2["Arrow"] = "arrow";
  MarkerType2["ArrowClosed"] = "arrowclosed";
})(MarkerType || (MarkerType = {}));
var Position;
(function(Position2) {
  Position2["Left"] = "left";
  Position2["Top"] = "top";
  Position2["Right"] = "right";
  Position2["Bottom"] = "bottom";
})(Position || (Position = {}));
var oppositePosition = {
  [Position.Left]: Position.Right,
  [Position.Right]: Position.Left,
  [Position.Top]: Position.Bottom,
  [Position.Bottom]: Position.Top
};
function getConnectionStatus(isValid) {
  return isValid === null ? null : isValid ? "valid" : "invalid";
}
var isEdgeBase = (element) => "id" in element && "source" in element && "target" in element;
var isNodeBase = (element) => "id" in element && "position" in element && !("source" in element) && !("target" in element);
var isInternalNodeBase = (element) => "id" in element && "internals" in element && !("source" in element) && !("target" in element);
var getNodePositionWithOrigin = (node, nodeOrigin = [0, 0]) => {
  const { width, height } = getNodeDimensions(node);
  const origin = node.origin ?? nodeOrigin;
  const offsetX = width * origin[0];
  const offsetY = height * origin[1];
  return {
    x: node.position.x - offsetX,
    y: node.position.y - offsetY
  };
};
var getNodesBounds = (nodes, params = { nodeOrigin: [0, 0] }) => {
  if (!params.nodeLookup) {
    console.warn("Please use `getNodesBounds` from `useReactFlow`/`useSvelteFlow` hook to ensure correct values for sub flows. If not possible, you have to provide a nodeLookup to support sub flows.");
  }
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const box = nodes.reduce((currBox, nodeOrId) => {
    const isId = typeof nodeOrId === "string";
    let currentNode = !params.nodeLookup && !isId ? nodeOrId : void 0;
    if (params.nodeLookup) {
      currentNode = isId ? params.nodeLookup.get(nodeOrId) : !isInternalNodeBase(nodeOrId) ? params.nodeLookup.get(nodeOrId.id) : nodeOrId;
    }
    const nodeBox = currentNode ? nodeToBox(currentNode, params.nodeOrigin) : { x: 0, y: 0, x2: 0, y2: 0 };
    return getBoundsOfBoxes(currBox, nodeBox);
  }, { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity });
  return boxToRect(box);
};
var getInternalNodesBounds = (nodeLookup, params = {}) => {
  let box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  let hasVisibleNodes = false;
  nodeLookup.forEach((node) => {
    if (params.filter === void 0 || params.filter(node)) {
      box = getBoundsOfBoxes(box, nodeToBox(node));
      hasVisibleNodes = true;
    }
  });
  return hasVisibleNodes ? boxToRect(box) : { x: 0, y: 0, width: 0, height: 0 };
};
var getNodesInside = (nodes, rect, [tx, ty, tScale] = [0, 0, 1], partially = false, excludeNonSelectableNodes = false) => {
  const paneRect = {
    ...pointToRendererPoint(rect, [tx, ty, tScale]),
    width: rect.width / tScale,
    height: rect.height / tScale
  };
  const visibleNodes = [];
  for (const node of nodes.values()) {
    const { measured, selectable = true, hidden = false } = node;
    if (excludeNonSelectableNodes && !selectable || hidden) {
      continue;
    }
    const width = measured.width ?? node.width ?? node.initialWidth ?? null;
    const height = measured.height ?? node.height ?? node.initialHeight ?? null;
    const overlappingArea = getOverlappingArea(paneRect, nodeToRect(node));
    const area = (width ?? 0) * (height ?? 0);
    const partiallyVisible = partially && overlappingArea > 0;
    const forceInitialRender = !node.internals.handleBounds;
    const isVisible = forceInitialRender || partiallyVisible || overlappingArea >= area;
    if (isVisible || node.dragging) {
      visibleNodes.push(node);
    }
  }
  return visibleNodes;
};
var getConnectedEdges = (nodes, edges) => {
  const nodeIds = /* @__PURE__ */ new Set();
  nodes.forEach((node) => {
    nodeIds.add(node.id);
  });
  return edges.filter((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target));
};
function getFitViewNodes(nodeLookup, options) {
  const fitViewNodes = /* @__PURE__ */ new Map();
  const optionNodeIds = options?.nodes ? new Set(options.nodes.map((node) => node.id)) : null;
  nodeLookup.forEach((n) => {
    const isVisible = n.measured.width && n.measured.height && (options?.includeHiddenNodes || !n.hidden);
    if (isVisible && (!optionNodeIds || optionNodeIds.has(n.id))) {
      fitViewNodes.set(n.id, n);
    }
  });
  return fitViewNodes;
}
async function fitViewport({ nodes, width, height, panZoom, minZoom, maxZoom }, options) {
  if (nodes.size === 0) {
    return Promise.resolve(true);
  }
  const nodesToFit = getFitViewNodes(nodes, options);
  const bounds = getInternalNodesBounds(nodesToFit);
  const viewport = getViewportForBounds(bounds, width, height, options?.minZoom ?? minZoom, options?.maxZoom ?? maxZoom, options?.padding ?? 0.1);
  await panZoom.setViewport(viewport, {
    duration: options?.duration,
    ease: options?.ease,
    interpolate: options?.interpolate
  });
  return Promise.resolve(true);
}
function calculateNodePosition({ nodeId, nextPosition, nodeLookup, nodeOrigin = [0, 0], nodeExtent, onError }) {
  const node = nodeLookup.get(nodeId);
  const parentNode = node.parentId ? nodeLookup.get(node.parentId) : void 0;
  const { x: parentX, y: parentY } = parentNode ? parentNode.internals.positionAbsolute : { x: 0, y: 0 };
  const origin = node.origin ?? nodeOrigin;
  let extent = node.extent || nodeExtent;
  if (node.extent === "parent" && !node.expandParent) {
    if (!parentNode) {
      onError?.("005", errorMessages["error005"]());
    } else {
      const parentWidth = parentNode.measured.width;
      const parentHeight = parentNode.measured.height;
      if (parentWidth && parentHeight) {
        extent = [
          [parentX, parentY],
          [parentX + parentWidth, parentY + parentHeight]
        ];
      }
    }
  } else if (parentNode && isCoordinateExtent(node.extent)) {
    extent = [
      [node.extent[0][0] + parentX, node.extent[0][1] + parentY],
      [node.extent[1][0] + parentX, node.extent[1][1] + parentY]
    ];
  }
  const positionAbsolute = isCoordinateExtent(extent) ? clampPosition(nextPosition, extent, node.measured) : nextPosition;
  if (node.measured.width === void 0 || node.measured.height === void 0) {
    onError?.("015", errorMessages["error015"]());
  }
  return {
    position: {
      x: positionAbsolute.x - parentX + (node.measured.width ?? 0) * origin[0],
      y: positionAbsolute.y - parentY + (node.measured.height ?? 0) * origin[1]
    },
    positionAbsolute
  };
}
async function getElementsToRemove({ nodesToRemove = [], edgesToRemove = [], nodes, edges, onBeforeDelete }) {
  const nodeIds = new Set(nodesToRemove.map((node) => node.id));
  const matchingNodes = [];
  for (const node of nodes) {
    if (node.deletable === false) {
      continue;
    }
    const isIncluded = nodeIds.has(node.id);
    const parentHit = !isIncluded && node.parentId && matchingNodes.find((n) => n.id === node.parentId);
    if (isIncluded || parentHit) {
      matchingNodes.push(node);
    }
  }
  const edgeIds = new Set(edgesToRemove.map((edge) => edge.id));
  const deletableEdges = edges.filter((edge) => edge.deletable !== false);
  const connectedEdges = getConnectedEdges(matchingNodes, deletableEdges);
  const matchingEdges = connectedEdges;
  for (const edge of deletableEdges) {
    const isIncluded = edgeIds.has(edge.id);
    if (isIncluded && !matchingEdges.find((e) => e.id === edge.id)) {
      matchingEdges.push(edge);
    }
  }
  if (!onBeforeDelete) {
    return {
      edges: matchingEdges,
      nodes: matchingNodes
    };
  }
  const onBeforeDeleteResult = await onBeforeDelete({
    nodes: matchingNodes,
    edges: matchingEdges
  });
  if (typeof onBeforeDeleteResult === "boolean") {
    return onBeforeDeleteResult ? { edges: matchingEdges, nodes: matchingNodes } : { edges: [], nodes: [] };
  }
  return onBeforeDeleteResult;
}
var clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);
var clampPosition = (position = { x: 0, y: 0 }, extent, dimensions) => ({
  x: clamp(position.x, extent[0][0], extent[1][0] - (dimensions?.width ?? 0)),
  y: clamp(position.y, extent[0][1], extent[1][1] - (dimensions?.height ?? 0))
});
function clampPositionToParent(childPosition, childDimensions, parent) {
  const { width: parentWidth, height: parentHeight } = getNodeDimensions(parent);
  const { x: parentX, y: parentY } = parent.internals.positionAbsolute;
  return clampPosition(childPosition, [
    [parentX, parentY],
    [parentX + parentWidth, parentY + parentHeight]
  ], childDimensions);
}
var calcAutoPanVelocity = (value, min, max) => {
  if (value < min) {
    return clamp(Math.abs(value - min), 1, min) / min;
  } else if (value > max) {
    return -clamp(Math.abs(value - max), 1, min) / min;
  }
  return 0;
};
var calcAutoPan = (pos, bounds, speed = 15, distance2 = 40) => {
  const xMovement = calcAutoPanVelocity(pos.x, distance2, bounds.width - distance2) * speed;
  const yMovement = calcAutoPanVelocity(pos.y, distance2, bounds.height - distance2) * speed;
  return [xMovement, yMovement];
};
var getBoundsOfBoxes = (box1, box2) => ({
  x: Math.min(box1.x, box2.x),
  y: Math.min(box1.y, box2.y),
  x2: Math.max(box1.x2, box2.x2),
  y2: Math.max(box1.y2, box2.y2)
});
var rectToBox = ({ x, y, width, height }) => ({
  x,
  y,
  x2: x + width,
  y2: y + height
});
var boxToRect = ({ x, y, x2, y2 }) => ({
  x,
  y,
  width: x2 - x,
  height: y2 - y
});
var nodeToRect = (node, nodeOrigin = [0, 0]) => {
  const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
  return {
    x,
    y,
    width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
  };
};
var nodeToBox = (node, nodeOrigin = [0, 0]) => {
  const { x, y } = isInternalNodeBase(node) ? node.internals.positionAbsolute : getNodePositionWithOrigin(node, nodeOrigin);
  return {
    x,
    y,
    x2: x + (node.measured?.width ?? node.width ?? node.initialWidth ?? 0),
    y2: y + (node.measured?.height ?? node.height ?? node.initialHeight ?? 0)
  };
};
var getBoundsOfRects = (rect1, rect2) => boxToRect(getBoundsOfBoxes(rectToBox(rect1), rectToBox(rect2)));
var getOverlappingArea = (rectA, rectB) => {
  const xOverlap = Math.max(0, Math.min(rectA.x + rectA.width, rectB.x + rectB.width) - Math.max(rectA.x, rectB.x));
  const yOverlap = Math.max(0, Math.min(rectA.y + rectA.height, rectB.y + rectB.height) - Math.max(rectA.y, rectB.y));
  return Math.ceil(xOverlap * yOverlap);
};
var isRectObject = (obj) => isNumeric(obj.width) && isNumeric(obj.height) && isNumeric(obj.x) && isNumeric(obj.y);
var isNumeric = (n) => !isNaN(n) && isFinite(n);
var devWarn = (id2, message) => {
  if (true) {
    console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id2}`);
  }
};
var snapPosition = (position, snapGrid = [1, 1]) => {
  return {
    x: snapGrid[0] * Math.round(position.x / snapGrid[0]),
    y: snapGrid[1] * Math.round(position.y / snapGrid[1])
  };
};
var pointToRendererPoint = ({ x, y }, [tx, ty, tScale], snapToGrid = false, snapGrid = [1, 1]) => {
  const position = {
    x: (x - tx) / tScale,
    y: (y - ty) / tScale
  };
  return snapToGrid ? snapPosition(position, snapGrid) : position;
};
var rendererPointToPoint = ({ x, y }, [tx, ty, tScale]) => {
  return {
    x: x * tScale + tx,
    y: y * tScale + ty
  };
};
function parsePadding(padding, viewport) {
  if (typeof padding === "number") {
    return Math.floor((viewport - viewport / (1 + padding)) * 0.5);
  }
  if (typeof padding === "string" && padding.endsWith("px")) {
    const paddingValue = parseFloat(padding);
    if (!Number.isNaN(paddingValue)) {
      return Math.floor(paddingValue);
    }
  }
  if (typeof padding === "string" && padding.endsWith("%")) {
    const paddingValue = parseFloat(padding);
    if (!Number.isNaN(paddingValue)) {
      return Math.floor(viewport * paddingValue * 0.01);
    }
  }
  console.error(`[React Flow] The padding value "${padding}" is invalid. Please provide a number or a string with a valid unit (px or %).`);
  return 0;
}
function parsePaddings(padding, width, height) {
  if (typeof padding === "string" || typeof padding === "number") {
    const paddingY = parsePadding(padding, height);
    const paddingX = parsePadding(padding, width);
    return {
      top: paddingY,
      right: paddingX,
      bottom: paddingY,
      left: paddingX,
      x: paddingX * 2,
      y: paddingY * 2
    };
  }
  if (typeof padding === "object") {
    const top = parsePadding(padding.top ?? padding.y ?? 0, height);
    const bottom = parsePadding(padding.bottom ?? padding.y ?? 0, height);
    const left = parsePadding(padding.left ?? padding.x ?? 0, width);
    const right = parsePadding(padding.right ?? padding.x ?? 0, width);
    return { top, right, bottom, left, x: left + right, y: top + bottom };
  }
  return { top: 0, right: 0, bottom: 0, left: 0, x: 0, y: 0 };
}
function calculateAppliedPaddings(bounds, x, y, zoom, width, height) {
  const { x: left, y: top } = rendererPointToPoint(bounds, [x, y, zoom]);
  const { x: boundRight, y: boundBottom } = rendererPointToPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, [x, y, zoom]);
  const right = width - boundRight;
  const bottom = height - boundBottom;
  return {
    left: Math.floor(left),
    top: Math.floor(top),
    right: Math.floor(right),
    bottom: Math.floor(bottom)
  };
}
var getViewportForBounds = (bounds, width, height, minZoom, maxZoom, padding) => {
  const p = parsePaddings(padding, width, height);
  const xZoom = (width - p.x) / bounds.width;
  const yZoom = (height - p.y) / bounds.height;
  const zoom = Math.min(xZoom, yZoom);
  const clampedZoom = clamp(zoom, minZoom, maxZoom);
  const boundsCenterX = bounds.x + bounds.width / 2;
  const boundsCenterY = bounds.y + bounds.height / 2;
  const x = width / 2 - boundsCenterX * clampedZoom;
  const y = height / 2 - boundsCenterY * clampedZoom;
  const newPadding = calculateAppliedPaddings(bounds, x, y, clampedZoom, width, height);
  const offset = {
    left: Math.min(newPadding.left - p.left, 0),
    top: Math.min(newPadding.top - p.top, 0),
    right: Math.min(newPadding.right - p.right, 0),
    bottom: Math.min(newPadding.bottom - p.bottom, 0)
  };
  return {
    x: x - offset.left + offset.right,
    y: y - offset.top + offset.bottom,
    zoom: clampedZoom
  };
};
var isMacOs = () => typeof navigator !== "undefined" && navigator?.userAgent?.indexOf("Mac") >= 0;
function isCoordinateExtent(extent) {
  return extent !== void 0 && extent !== null && extent !== "parent";
}
function getNodeDimensions(node) {
  return {
    width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0
  };
}
function nodeHasDimensions(node) {
  return (node.measured?.width ?? node.width ?? node.initialWidth) !== void 0 && (node.measured?.height ?? node.height ?? node.initialHeight) !== void 0;
}
function evaluateAbsolutePosition(position, dimensions = { width: 0, height: 0 }, parentId, nodeLookup, nodeOrigin) {
  const positionAbsolute = { ...position };
  const parent = nodeLookup.get(parentId);
  if (parent) {
    const origin = parent.origin || nodeOrigin;
    positionAbsolute.x += parent.internals.positionAbsolute.x - (dimensions.width ?? 0) * origin[0];
    positionAbsolute.y += parent.internals.positionAbsolute.y - (dimensions.height ?? 0) * origin[1];
  }
  return positionAbsolute;
}
function areSetsEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}
function withResolvers() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function mergeAriaLabelConfig(partial) {
  return { ...defaultAriaLabelConfig, ...partial || {} };
}
function getPointerPosition(event, { snapGrid = [0, 0], snapToGrid = false, transform: transform2, containerBounds }) {
  const { x, y } = getEventPosition(event);
  const pointerPos = pointToRendererPoint({ x: x - (containerBounds?.left ?? 0), y: y - (containerBounds?.top ?? 0) }, transform2);
  const { x: xSnapped, y: ySnapped } = snapToGrid ? snapPosition(pointerPos, snapGrid) : pointerPos;
  return {
    xSnapped,
    ySnapped,
    ...pointerPos
  };
}
var getDimensions = (node) => ({
  width: node.offsetWidth,
  height: node.offsetHeight
});
var getHostForElement = (element) => element?.getRootNode?.() || window?.document;
var inputTags = ["INPUT", "SELECT", "TEXTAREA"];
function isInputDOMNode(event) {
  const target = event.composedPath?.()?.[0] || event.target;
  if (target?.nodeType !== 1)
    return false;
  const isInput = inputTags.includes(target.nodeName) || target.hasAttribute("contenteditable");
  return isInput || !!target.closest(".nokey");
}
var isMouseEvent = (event) => "clientX" in event;
var getEventPosition = (event, bounds) => {
  const isMouse = isMouseEvent(event);
  const evtX = isMouse ? event.clientX : event.touches?.[0].clientX;
  const evtY = isMouse ? event.clientY : event.touches?.[0].clientY;
  return {
    x: evtX - (bounds?.left ?? 0),
    y: evtY - (bounds?.top ?? 0)
  };
};
var getHandleBounds = (type, nodeElement, nodeBounds, zoom, nodeId) => {
  const handles = nodeElement.querySelectorAll(`.${type}`);
  if (!handles || !handles.length) {
    return null;
  }
  return Array.from(handles).map((handle) => {
    const handleBounds = handle.getBoundingClientRect();
    return {
      id: handle.getAttribute("data-handleid"),
      type,
      nodeId,
      position: handle.getAttribute("data-handlepos"),
      x: (handleBounds.left - nodeBounds.left) / zoom,
      y: (handleBounds.top - nodeBounds.top) / zoom,
      ...getDimensions(handle)
    };
  });
};
function getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY }) {
  const centerX = sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125;
  const centerY = sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125;
  const offsetX = Math.abs(centerX - sourceX);
  const offsetY = Math.abs(centerY - sourceY);
  return [centerX, centerY, offsetX, offsetY];
}
function calculateControlOffset(distance2, curvature) {
  if (distance2 >= 0) {
    return 0.5 * distance2;
  }
  return curvature * 25 * Math.sqrt(-distance2);
}
function getControlWithCurvature({ pos, x1, y1, x2, y2, c }) {
  switch (pos) {
    case Position.Left:
      return [x1 - calculateControlOffset(x1 - x2, c), y1];
    case Position.Right:
      return [x1 + calculateControlOffset(x2 - x1, c), y1];
    case Position.Top:
      return [x1, y1 - calculateControlOffset(y1 - y2, c)];
    case Position.Bottom:
      return [x1, y1 + calculateControlOffset(y2 - y1, c)];
  }
}
function getBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, curvature = 0.25 }) {
  const [sourceControlX, sourceControlY] = getControlWithCurvature({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
    c: curvature
  });
  const [targetControlX, targetControlY] = getControlWithCurvature({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY,
    c: curvature
  });
  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY
  });
  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY
  ];
}
function getEdgeCenter({ sourceX, sourceY, targetX, targetY }) {
  const xOffset = Math.abs(targetX - sourceX) / 2;
  const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;
  const yOffset = Math.abs(targetY - sourceY) / 2;
  const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;
  return [centerX, centerY, xOffset, yOffset];
}
function getElevatedEdgeZIndex({ sourceNode, targetNode, selected: selected2 = false, zIndex = 0, elevateOnSelect = false, zIndexMode = "basic" }) {
  if (zIndexMode === "manual") {
    return zIndex;
  }
  const edgeZ = elevateOnSelect && selected2 ? zIndex + 1e3 : zIndex;
  const nodeZ = Math.max(sourceNode.parentId || elevateOnSelect && sourceNode.selected ? sourceNode.internals.z : 0, targetNode.parentId || elevateOnSelect && targetNode.selected ? targetNode.internals.z : 0);
  return edgeZ + nodeZ;
}
function isEdgeVisible({ sourceNode, targetNode, width, height, transform: transform2 }) {
  const edgeBox = getBoundsOfBoxes(nodeToBox(sourceNode), nodeToBox(targetNode));
  if (edgeBox.x === edgeBox.x2) {
    edgeBox.x2 += 1;
  }
  if (edgeBox.y === edgeBox.y2) {
    edgeBox.y2 += 1;
  }
  const viewRect = {
    x: -transform2[0] / transform2[2],
    y: -transform2[1] / transform2[2],
    width: width / transform2[2],
    height: height / transform2[2]
  };
  return getOverlappingArea(viewRect, boxToRect(edgeBox)) > 0;
}
var getEdgeId = ({ source, sourceHandle, target, targetHandle }) => `xy-edge__${source}${sourceHandle || ""}-${target}${targetHandle || ""}`;
var connectionExists = (edge, edges) => {
  return edges.some((el) => el.source === edge.source && el.target === edge.target && (el.sourceHandle === edge.sourceHandle || !el.sourceHandle && !edge.sourceHandle) && (el.targetHandle === edge.targetHandle || !el.targetHandle && !edge.targetHandle));
};
var addEdge = (edgeParams, edges, options = {}) => {
  if (!edgeParams.source || !edgeParams.target) {
    devWarn("006", errorMessages["error006"]());
    return edges;
  }
  const edgeIdGenerator = options.getEdgeId || getEdgeId;
  let edge;
  if (isEdgeBase(edgeParams)) {
    edge = { ...edgeParams };
  } else {
    edge = {
      ...edgeParams,
      id: edgeIdGenerator(edgeParams)
    };
  }
  if (connectionExists(edge, edges)) {
    return edges;
  }
  if (edge.sourceHandle === null) {
    delete edge.sourceHandle;
  }
  if (edge.targetHandle === null) {
    delete edge.targetHandle;
  }
  return edges.concat(edge);
};
function getStraightPath({ sourceX, sourceY, targetX, targetY }) {
  const [labelX, labelY, offsetX, offsetY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY
  });
  return [`M ${sourceX},${sourceY}L ${targetX},${targetY}`, labelX, labelY, offsetX, offsetY];
}
var handleDirections = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 }
};
var getDirection = ({ source, sourcePosition = Position.Bottom, target }) => {
  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
  }
  return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
};
var distance = (a, b) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
function getPoints({ source, sourcePosition = Position.Bottom, target, targetPosition = Position.Top, center, offset, stepPosition }) {
  const sourceDir = handleDirections[sourcePosition];
  const targetDir = handleDirections[targetPosition];
  const sourceGapped = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset };
  const targetGapped = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset };
  const dir = getDirection({
    source: sourceGapped,
    sourcePosition,
    target: targetGapped
  });
  const dirAccessor = dir.x !== 0 ? "x" : "y";
  const currDir = dir[dirAccessor];
  let points = [];
  let centerX, centerY;
  const sourceGapOffset = { x: 0, y: 0 };
  const targetGapOffset = { x: 0, y: 0 };
  const [, , defaultOffsetX, defaultOffsetY] = getEdgeCenter({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y
  });
  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
    if (dirAccessor === "x") {
      centerX = center.x ?? sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
      centerY = center.y ?? (sourceGapped.y + targetGapped.y) / 2;
    } else {
      centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
      centerY = center.y ?? sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
    }
    const verticalSplit = [
      { x: centerX, y: sourceGapped.y },
      { x: centerX, y: targetGapped.y }
    ];
    const horizontalSplit = [
      { x: sourceGapped.x, y: centerY },
      { x: targetGapped.x, y: centerY }
    ];
    if (sourceDir[dirAccessor] === currDir) {
      points = dirAccessor === "x" ? verticalSplit : horizontalSplit;
    } else {
      points = dirAccessor === "x" ? horizontalSplit : verticalSplit;
    }
  } else {
    const sourceTarget = [{ x: sourceGapped.x, y: targetGapped.y }];
    const targetSource = [{ x: targetGapped.x, y: sourceGapped.y }];
    if (dirAccessor === "x") {
      points = sourceDir.x === currDir ? targetSource : sourceTarget;
    } else {
      points = sourceDir.y === currDir ? sourceTarget : targetSource;
    }
    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
      if (diff <= offset) {
        const gapOffset = Math.min(offset - 1, offset - diff);
        if (sourceDir[dirAccessor] === currDir) {
          sourceGapOffset[dirAccessor] = (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
        } else {
          targetGapOffset[dirAccessor] = (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
        }
      }
    }
    if (sourcePosition !== targetPosition) {
      const dirAccessorOpposite = dirAccessor === "x" ? "y" : "x";
      const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite];
      const sourceGtTargetOppo = sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite];
      const sourceLtTargetOppo = sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite];
      const flipSourceTarget = sourceDir[dirAccessor] === 1 && (!isSameDir && sourceGtTargetOppo || isSameDir && sourceLtTargetOppo) || sourceDir[dirAccessor] !== 1 && (!isSameDir && sourceLtTargetOppo || isSameDir && sourceGtTargetOppo);
      if (flipSourceTarget) {
        points = dirAccessor === "x" ? sourceTarget : targetSource;
      }
    }
    const sourceGapPoint = { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y };
    const targetGapPoint = { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y };
    const maxXDistance = Math.max(Math.abs(sourceGapPoint.x - points[0].x), Math.abs(targetGapPoint.x - points[0].x));
    const maxYDistance = Math.max(Math.abs(sourceGapPoint.y - points[0].y), Math.abs(targetGapPoint.y - points[0].y));
    if (maxXDistance >= maxYDistance) {
      centerX = (sourceGapPoint.x + targetGapPoint.x) / 2;
      centerY = points[0].y;
    } else {
      centerX = points[0].x;
      centerY = (sourceGapPoint.y + targetGapPoint.y) / 2;
    }
  }
  const pathPoints = [
    source,
    { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y },
    ...points,
    { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y },
    target
  ];
  return [pathPoints, centerX, centerY, defaultOffsetX, defaultOffsetY];
}
function getBend(a, b, c, size) {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  const { x, y } = b;
  if (a.x === x && x === c.x || a.y === y && y === c.y) {
    return `L${x} ${y}`;
  }
  if (a.y === y) {
    const xDir2 = a.x < c.x ? -1 : 1;
    const yDir2 = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir2},${y}Q ${x},${y} ${x},${y + bendSize * yDir2}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}
function getSmoothStepPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, borderRadius = 5, centerX, centerY, offset = 20, stepPosition = 0.5 }) {
  const [points, labelX, labelY, offsetX, offsetY] = getPoints({
    source: { x: sourceX, y: sourceY },
    sourcePosition,
    target: { x: targetX, y: targetY },
    targetPosition,
    center: { x: centerX, y: centerY },
    offset,
    stepPosition
  });
  const path = points.reduce((res, p, i) => {
    let segment = "";
    if (i > 0 && i < points.length - 1) {
      segment = getBend(points[i - 1], p, points[i + 1], borderRadius);
    } else {
      segment = `${i === 0 ? "M" : "L"}${p.x} ${p.y}`;
    }
    res += segment;
    return res;
  }, "");
  return [path, labelX, labelY, offsetX, offsetY];
}
function isNodeInitialized(node) {
  return node && !!(node.internals.handleBounds || node.handles?.length) && !!(node.measured.width || node.width || node.initialWidth);
}
function getEdgePosition(params) {
  const { sourceNode, targetNode } = params;
  if (!isNodeInitialized(sourceNode) || !isNodeInitialized(targetNode)) {
    return null;
  }
  const sourceHandleBounds = sourceNode.internals.handleBounds || toHandleBounds(sourceNode.handles);
  const targetHandleBounds = targetNode.internals.handleBounds || toHandleBounds(targetNode.handles);
  const sourceHandle = getHandle$1(sourceHandleBounds?.source ?? [], params.sourceHandle);
  const targetHandle = getHandle$1(
    // when connection type is loose we can define all handles as sources and connect source -> source
    params.connectionMode === ConnectionMode.Strict ? targetHandleBounds?.target ?? [] : (targetHandleBounds?.target ?? []).concat(targetHandleBounds?.source ?? []),
    params.targetHandle
  );
  if (!sourceHandle || !targetHandle) {
    params.onError?.("008", errorMessages["error008"](!sourceHandle ? "source" : "target", {
      id: params.id,
      sourceHandle: params.sourceHandle,
      targetHandle: params.targetHandle
    }));
    return null;
  }
  const sourcePosition = sourceHandle?.position || Position.Bottom;
  const targetPosition = targetHandle?.position || Position.Top;
  const source = getHandlePosition(sourceNode, sourceHandle, sourcePosition);
  const target = getHandlePosition(targetNode, targetHandle, targetPosition);
  return {
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition,
    targetPosition
  };
}
function toHandleBounds(handles) {
  if (!handles) {
    return null;
  }
  const source = [];
  const target = [];
  for (const handle of handles) {
    handle.width = handle.width ?? 1;
    handle.height = handle.height ?? 1;
    if (handle.type === "source") {
      source.push(handle);
    } else if (handle.type === "target") {
      target.push(handle);
    }
  }
  return {
    source,
    target
  };
}
function getHandlePosition(node, handle, fallbackPosition = Position.Left, center = false) {
  const x = (handle?.x ?? 0) + node.internals.positionAbsolute.x;
  const y = (handle?.y ?? 0) + node.internals.positionAbsolute.y;
  const { width, height } = handle ?? getNodeDimensions(node);
  if (center) {
    return { x: x + width / 2, y: y + height / 2 };
  }
  const position = handle?.position ?? fallbackPosition;
  switch (position) {
    case Position.Top:
      return { x: x + width / 2, y };
    case Position.Right:
      return { x: x + width, y: y + height / 2 };
    case Position.Bottom:
      return { x: x + width / 2, y: y + height };
    case Position.Left:
      return { x, y: y + height / 2 };
  }
}
function getHandle$1(bounds, handleId) {
  if (!bounds) {
    return null;
  }
  return (!handleId ? bounds[0] : bounds.find((d) => d.id === handleId)) || null;
}
function getMarkerId(marker, id2) {
  if (!marker) {
    return "";
  }
  if (typeof marker === "string") {
    return marker;
  }
  const idPrefix = id2 ? `${id2}__` : "";
  return `${idPrefix}${Object.keys(marker).sort().map((key) => `${key}=${marker[key]}`).join("&")}`;
}
function createMarkerIds(edges, { id: id2, defaultColor, defaultMarkerStart, defaultMarkerEnd }) {
  const ids = /* @__PURE__ */ new Set();
  return edges.reduce((markers, edge) => {
    [edge.markerStart || defaultMarkerStart, edge.markerEnd || defaultMarkerEnd].forEach((marker) => {
      if (marker && typeof marker === "object") {
        const markerId = getMarkerId(marker, id2);
        if (!ids.has(markerId)) {
          markers.push({ id: markerId, color: marker.color || defaultColor, ...marker });
          ids.add(markerId);
        }
      }
    });
    return markers;
  }, []).sort((a, b) => a.id.localeCompare(b.id));
}
var SELECTED_NODE_Z = 1e3;
var ROOT_PARENT_Z_INCREMENT = 10;
var defaultOptions = {
  nodeOrigin: [0, 0],
  nodeExtent: infiniteExtent,
  elevateNodesOnSelect: true,
  zIndexMode: "basic",
  defaults: {}
};
var adoptUserNodesDefaultOptions = {
  ...defaultOptions,
  checkEquality: true
};
function mergeObjects(base, incoming) {
  const result = { ...base };
  for (const key in incoming) {
    if (incoming[key] !== void 0) {
      result[key] = incoming[key];
    }
  }
  return result;
}
function updateAbsolutePositions(nodeLookup, parentLookup, options) {
  const _options = mergeObjects(defaultOptions, options);
  for (const node of nodeLookup.values()) {
    if (node.parentId) {
      updateChildNode(node, nodeLookup, parentLookup, _options);
    } else {
      const positionWithOrigin = getNodePositionWithOrigin(node, _options.nodeOrigin);
      const extent = isCoordinateExtent(node.extent) ? node.extent : _options.nodeExtent;
      const clampedPosition = clampPosition(positionWithOrigin, extent, getNodeDimensions(node));
      node.internals.positionAbsolute = clampedPosition;
    }
  }
}
function parseHandles(userNode, internalNode) {
  if (!userNode.handles) {
    return !userNode.measured ? void 0 : internalNode?.internals.handleBounds;
  }
  const source = [];
  const target = [];
  for (const handle of userNode.handles) {
    const handleBounds = {
      id: handle.id,
      width: handle.width ?? 1,
      height: handle.height ?? 1,
      nodeId: userNode.id,
      x: handle.x,
      y: handle.y,
      position: handle.position,
      type: handle.type
    };
    if (handle.type === "source") {
      source.push(handleBounds);
    } else if (handle.type === "target") {
      target.push(handleBounds);
    }
  }
  return {
    source,
    target
  };
}
function isManualZIndexMode(zIndexMode) {
  return zIndexMode === "manual";
}
function adoptUserNodes(nodes, nodeLookup, parentLookup, options = {}) {
  const _options = mergeObjects(adoptUserNodesDefaultOptions, options);
  const rootParentIndex = { i: 0 };
  const tmpLookup = new Map(nodeLookup);
  const selectedNodeZ = _options?.elevateNodesOnSelect && !isManualZIndexMode(_options.zIndexMode) ? SELECTED_NODE_Z : 0;
  let nodesInitialized = nodes.length > 0;
  nodeLookup.clear();
  parentLookup.clear();
  for (const userNode of nodes) {
    let internalNode = tmpLookup.get(userNode.id);
    if (_options.checkEquality && userNode === internalNode?.internals.userNode) {
      nodeLookup.set(userNode.id, internalNode);
    } else {
      const positionWithOrigin = getNodePositionWithOrigin(userNode, _options.nodeOrigin);
      const extent = isCoordinateExtent(userNode.extent) ? userNode.extent : _options.nodeExtent;
      const clampedPosition = clampPosition(positionWithOrigin, extent, getNodeDimensions(userNode));
      internalNode = {
        ..._options.defaults,
        ...userNode,
        measured: {
          width: userNode.measured?.width,
          height: userNode.measured?.height
        },
        internals: {
          positionAbsolute: clampedPosition,
          // if user re-initializes the node or removes `measured` for whatever reason, we reset the handleBounds so that the node gets re-measured
          handleBounds: parseHandles(userNode, internalNode),
          z: calculateZ(userNode, selectedNodeZ, _options.zIndexMode),
          userNode
        }
      };
      nodeLookup.set(userNode.id, internalNode);
    }
    if ((internalNode.measured === void 0 || internalNode.measured.width === void 0 || internalNode.measured.height === void 0) && !internalNode.hidden) {
      nodesInitialized = false;
    }
    if (userNode.parentId) {
      updateChildNode(internalNode, nodeLookup, parentLookup, options, rootParentIndex);
    }
  }
  return nodesInitialized;
}
function updateParentLookup(node, parentLookup) {
  if (!node.parentId) {
    return;
  }
  const childNodes = parentLookup.get(node.parentId);
  if (childNodes) {
    childNodes.set(node.id, node);
  } else {
    parentLookup.set(node.parentId, /* @__PURE__ */ new Map([[node.id, node]]));
  }
}
function updateChildNode(node, nodeLookup, parentLookup, options, rootParentIndex) {
  const { elevateNodesOnSelect, nodeOrigin, nodeExtent, zIndexMode } = mergeObjects(defaultOptions, options);
  const parentId = node.parentId;
  const parentNode = nodeLookup.get(parentId);
  if (!parentNode) {
    console.warn(`Parent node ${parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`);
    return;
  }
  updateParentLookup(node, parentLookup);
  if (rootParentIndex && !parentNode.parentId && parentNode.internals.rootParentIndex === void 0 && zIndexMode === "auto") {
    parentNode.internals.rootParentIndex = ++rootParentIndex.i;
    parentNode.internals.z = parentNode.internals.z + rootParentIndex.i * ROOT_PARENT_Z_INCREMENT;
  }
  if (rootParentIndex && parentNode.internals.rootParentIndex !== void 0) {
    rootParentIndex.i = parentNode.internals.rootParentIndex;
  }
  const selectedNodeZ = elevateNodesOnSelect && !isManualZIndexMode(zIndexMode) ? SELECTED_NODE_Z : 0;
  const { x, y, z } = calculateChildXYZ(node, parentNode, nodeOrigin, nodeExtent, selectedNodeZ, zIndexMode);
  const { positionAbsolute } = node.internals;
  const positionChanged = x !== positionAbsolute.x || y !== positionAbsolute.y;
  if (positionChanged || z !== node.internals.z) {
    nodeLookup.set(node.id, {
      ...node,
      internals: {
        ...node.internals,
        positionAbsolute: positionChanged ? { x, y } : positionAbsolute,
        z
      }
    });
  }
}
function calculateZ(node, selectedNodeZ, zIndexMode) {
  const zIndex = isNumeric(node.zIndex) ? node.zIndex : 0;
  if (isManualZIndexMode(zIndexMode)) {
    return zIndex;
  }
  return zIndex + (node.selected ? selectedNodeZ : 0);
}
function calculateChildXYZ(childNode, parentNode, nodeOrigin, nodeExtent, selectedNodeZ, zIndexMode) {
  const { x: parentX, y: parentY } = parentNode.internals.positionAbsolute;
  const childDimensions = getNodeDimensions(childNode);
  const positionWithOrigin = getNodePositionWithOrigin(childNode, nodeOrigin);
  const clampedPosition = isCoordinateExtent(childNode.extent) ? clampPosition(positionWithOrigin, childNode.extent, childDimensions) : positionWithOrigin;
  let absolutePosition = clampPosition({ x: parentX + clampedPosition.x, y: parentY + clampedPosition.y }, nodeExtent, childDimensions);
  if (childNode.extent === "parent") {
    absolutePosition = clampPositionToParent(absolutePosition, childDimensions, parentNode);
  }
  const childZ = calculateZ(childNode, selectedNodeZ, zIndexMode);
  const parentZ = parentNode.internals.z ?? 0;
  return {
    x: absolutePosition.x,
    y: absolutePosition.y,
    z: parentZ >= childZ ? parentZ + 1 : childZ
  };
}
function handleExpandParent(children2, nodeLookup, parentLookup, nodeOrigin = [0, 0]) {
  const changes = [];
  const parentExpansions = /* @__PURE__ */ new Map();
  for (const child of children2) {
    const parent = nodeLookup.get(child.parentId);
    if (!parent) {
      continue;
    }
    const parentRect = parentExpansions.get(child.parentId)?.expandedRect ?? nodeToRect(parent);
    const expandedRect = getBoundsOfRects(parentRect, child.rect);
    parentExpansions.set(child.parentId, { expandedRect, parent });
  }
  if (parentExpansions.size > 0) {
    parentExpansions.forEach(({ expandedRect, parent }, parentId) => {
      const positionAbsolute = parent.internals.positionAbsolute;
      const dimensions = getNodeDimensions(parent);
      const origin = parent.origin ?? nodeOrigin;
      const xChange = expandedRect.x < positionAbsolute.x ? Math.round(Math.abs(positionAbsolute.x - expandedRect.x)) : 0;
      const yChange = expandedRect.y < positionAbsolute.y ? Math.round(Math.abs(positionAbsolute.y - expandedRect.y)) : 0;
      const newWidth = Math.max(dimensions.width, Math.round(expandedRect.width));
      const newHeight = Math.max(dimensions.height, Math.round(expandedRect.height));
      const widthChange = (newWidth - dimensions.width) * origin[0];
      const heightChange = (newHeight - dimensions.height) * origin[1];
      if (xChange > 0 || yChange > 0 || widthChange || heightChange) {
        changes.push({
          id: parentId,
          type: "position",
          position: {
            x: parent.position.x - xChange + widthChange,
            y: parent.position.y - yChange + heightChange
          }
        });
        parentLookup.get(parentId)?.forEach((childNode) => {
          if (!children2.some((child) => child.id === childNode.id)) {
            changes.push({
              id: childNode.id,
              type: "position",
              position: {
                x: childNode.position.x + xChange,
                y: childNode.position.y + yChange
              }
            });
          }
        });
      }
      if (dimensions.width < expandedRect.width || dimensions.height < expandedRect.height || xChange || yChange) {
        changes.push({
          id: parentId,
          type: "dimensions",
          setAttributes: true,
          dimensions: {
            width: newWidth + (xChange ? origin[0] * xChange - widthChange : 0),
            height: newHeight + (yChange ? origin[1] * yChange - heightChange : 0)
          }
        });
      }
    });
  }
  return changes;
}
function updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, zIndexMode) {
  const viewportNode = domNode?.querySelector(".xyflow__viewport");
  let updatedInternals = false;
  if (!viewportNode) {
    return { changes: [], updatedInternals };
  }
  const changes = [];
  const style2 = window.getComputedStyle(viewportNode);
  const { m22: zoom } = new window.DOMMatrixReadOnly(style2.transform);
  const parentExpandChildren = [];
  for (const update of updates.values()) {
    const node = nodeLookup.get(update.id);
    if (!node) {
      continue;
    }
    if (node.hidden) {
      nodeLookup.set(node.id, {
        ...node,
        internals: {
          ...node.internals,
          handleBounds: void 0
        }
      });
      updatedInternals = true;
      continue;
    }
    const dimensions = getDimensions(update.nodeElement);
    const dimensionChanged = node.measured.width !== dimensions.width || node.measured.height !== dimensions.height;
    const doUpdate = !!(dimensions.width && dimensions.height && (dimensionChanged || !node.internals.handleBounds || update.force));
    if (doUpdate) {
      const nodeBounds = update.nodeElement.getBoundingClientRect();
      const extent = isCoordinateExtent(node.extent) ? node.extent : nodeExtent;
      let { positionAbsolute } = node.internals;
      if (node.parentId && node.extent === "parent") {
        positionAbsolute = clampPositionToParent(positionAbsolute, dimensions, nodeLookup.get(node.parentId));
      } else if (extent) {
        positionAbsolute = clampPosition(positionAbsolute, extent, dimensions);
      }
      const newNode = {
        ...node,
        measured: dimensions,
        internals: {
          ...node.internals,
          positionAbsolute,
          handleBounds: {
            source: getHandleBounds("source", update.nodeElement, nodeBounds, zoom, node.id),
            target: getHandleBounds("target", update.nodeElement, nodeBounds, zoom, node.id)
          }
        }
      };
      nodeLookup.set(node.id, newNode);
      if (node.parentId) {
        updateChildNode(newNode, nodeLookup, parentLookup, { nodeOrigin, zIndexMode });
      }
      updatedInternals = true;
      if (dimensionChanged) {
        changes.push({
          id: node.id,
          type: "dimensions",
          dimensions
        });
        if (node.expandParent && node.parentId) {
          parentExpandChildren.push({
            id: node.id,
            parentId: node.parentId,
            rect: nodeToRect(newNode, nodeOrigin)
          });
        }
      }
    }
  }
  if (parentExpandChildren.length > 0) {
    const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
    changes.push(...parentExpandChanges);
  }
  return { changes, updatedInternals };
}
async function panBy({ delta, panZoom, transform: transform2, translateExtent, width, height }) {
  if (!panZoom || !delta.x && !delta.y) {
    return Promise.resolve(false);
  }
  const nextViewport = await panZoom.setViewportConstrained({
    x: transform2[0] + delta.x,
    y: transform2[1] + delta.y,
    zoom: transform2[2]
  }, [
    [0, 0],
    [width, height]
  ], translateExtent);
  const transformChanged = !!nextViewport && (nextViewport.x !== transform2[0] || nextViewport.y !== transform2[1] || nextViewport.k !== transform2[2]);
  return Promise.resolve(transformChanged);
}
function addConnectionToLookup(type, connection, connectionKey, connectionLookup, nodeId, handleId) {
  let key = nodeId;
  const nodeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
  connectionLookup.set(key, nodeMap.set(connectionKey, connection));
  key = `${nodeId}-${type}`;
  const typeMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
  connectionLookup.set(key, typeMap.set(connectionKey, connection));
  if (handleId) {
    key = `${nodeId}-${type}-${handleId}`;
    const handleMap = connectionLookup.get(key) || /* @__PURE__ */ new Map();
    connectionLookup.set(key, handleMap.set(connectionKey, connection));
  }
}
function updateConnectionLookup(connectionLookup, edgeLookup, edges) {
  connectionLookup.clear();
  edgeLookup.clear();
  for (const edge of edges) {
    const { source: sourceNode, target: targetNode, sourceHandle = null, targetHandle = null } = edge;
    const connection = { edgeId: edge.id, source: sourceNode, target: targetNode, sourceHandle, targetHandle };
    const sourceKey = `${sourceNode}-${sourceHandle}--${targetNode}-${targetHandle}`;
    const targetKey = `${targetNode}-${targetHandle}--${sourceNode}-${sourceHandle}`;
    addConnectionToLookup("source", connection, targetKey, connectionLookup, sourceNode, sourceHandle);
    addConnectionToLookup("target", connection, sourceKey, connectionLookup, targetNode, targetHandle);
    edgeLookup.set(edge.id, edge);
  }
}
function isParentSelected(node, nodeLookup) {
  if (!node.parentId) {
    return false;
  }
  const parentNode = nodeLookup.get(node.parentId);
  if (!parentNode) {
    return false;
  }
  if (parentNode.selected) {
    return true;
  }
  return isParentSelected(parentNode, nodeLookup);
}
function hasSelector(target, selector, domNode) {
  let current = target;
  do {
    if (current?.matches?.(selector))
      return true;
    if (current === domNode)
      return false;
    current = current?.parentElement;
  } while (current);
  return false;
}
function getDragItems(nodeLookup, nodesDraggable, mousePos, nodeId) {
  const dragItems = /* @__PURE__ */ new Map();
  for (const [id2, node] of nodeLookup) {
    if ((node.selected || node.id === nodeId) && (!node.parentId || !isParentSelected(node, nodeLookup)) && (node.draggable || nodesDraggable && typeof node.draggable === "undefined")) {
      const internalNode = nodeLookup.get(id2);
      if (internalNode) {
        dragItems.set(id2, {
          id: id2,
          position: internalNode.position || { x: 0, y: 0 },
          distance: {
            x: mousePos.x - internalNode.internals.positionAbsolute.x,
            y: mousePos.y - internalNode.internals.positionAbsolute.y
          },
          extent: internalNode.extent,
          parentId: internalNode.parentId,
          origin: internalNode.origin,
          expandParent: internalNode.expandParent,
          internals: {
            positionAbsolute: internalNode.internals.positionAbsolute || { x: 0, y: 0 }
          },
          measured: {
            width: internalNode.measured.width ?? 0,
            height: internalNode.measured.height ?? 0
          }
        });
      }
    }
  }
  return dragItems;
}
function getEventHandlerParams({ nodeId, dragItems, nodeLookup, dragging = true }) {
  const nodesFromDragItems = [];
  for (const [id2, dragItem] of dragItems) {
    const node2 = nodeLookup.get(id2)?.internals.userNode;
    if (node2) {
      nodesFromDragItems.push({
        ...node2,
        position: dragItem.position,
        dragging
      });
    }
  }
  if (!nodeId) {
    return [nodesFromDragItems[0], nodesFromDragItems];
  }
  const node = nodeLookup.get(nodeId)?.internals.userNode;
  return [
    !node ? nodesFromDragItems[0] : {
      ...node,
      position: dragItems.get(nodeId)?.position || node.position,
      dragging
    },
    nodesFromDragItems
  ];
}
function calculateSnapOffset({ dragItems, snapGrid, x, y }) {
  const refDragItem = dragItems.values().next().value;
  if (!refDragItem) {
    return null;
  }
  const refPos = {
    x: x - refDragItem.distance.x,
    y: y - refDragItem.distance.y
  };
  const refPosSnapped = snapPosition(refPos, snapGrid);
  return {
    x: refPosSnapped.x - refPos.x,
    y: refPosSnapped.y - refPos.y
  };
}
function XYDrag({ onNodeMouseDown, getStoreItems, onDragStart, onDrag, onDragStop }) {
  let lastPos = { x: null, y: null };
  let autoPanId = 0;
  let dragItems = /* @__PURE__ */ new Map();
  let autoPanStarted = false;
  let mousePosition = { x: 0, y: 0 };
  let containerBounds = null;
  let dragStarted = false;
  let d3Selection = null;
  let abortDrag = false;
  let nodePositionsChanged = false;
  let dragEvent = null;
  function update({ noDragClassName, handleSelector, domNode, isSelectable, nodeId, nodeClickDistance = 0 }) {
    d3Selection = select_default2(domNode);
    function updateNodes({ x, y }) {
      const { nodeLookup, nodeExtent, snapGrid, snapToGrid, nodeOrigin, onNodeDrag, onSelectionDrag, onError, updateNodePositions } = getStoreItems();
      lastPos = { x, y };
      let hasChange = false;
      const isMultiDrag = dragItems.size > 1;
      const nodesBox = isMultiDrag && nodeExtent ? rectToBox(getInternalNodesBounds(dragItems)) : null;
      const multiDragSnapOffset = isMultiDrag && snapToGrid ? calculateSnapOffset({
        dragItems,
        snapGrid,
        x,
        y
      }) : null;
      for (const [id2, dragItem] of dragItems) {
        if (!nodeLookup.has(id2)) {
          continue;
        }
        let nextPosition = { x: x - dragItem.distance.x, y: y - dragItem.distance.y };
        if (snapToGrid) {
          nextPosition = multiDragSnapOffset ? {
            x: Math.round(nextPosition.x + multiDragSnapOffset.x),
            y: Math.round(nextPosition.y + multiDragSnapOffset.y)
          } : snapPosition(nextPosition, snapGrid);
        }
        let adjustedNodeExtent = null;
        if (isMultiDrag && nodeExtent && !dragItem.extent && nodesBox) {
          const { positionAbsolute: positionAbsolute2 } = dragItem.internals;
          const x1 = positionAbsolute2.x - nodesBox.x + nodeExtent[0][0];
          const x2 = positionAbsolute2.x + dragItem.measured.width - nodesBox.x2 + nodeExtent[1][0];
          const y1 = positionAbsolute2.y - nodesBox.y + nodeExtent[0][1];
          const y2 = positionAbsolute2.y + dragItem.measured.height - nodesBox.y2 + nodeExtent[1][1];
          adjustedNodeExtent = [
            [x1, y1],
            [x2, y2]
          ];
        }
        const { position, positionAbsolute } = calculateNodePosition({
          nodeId: id2,
          nextPosition,
          nodeLookup,
          nodeExtent: adjustedNodeExtent ? adjustedNodeExtent : nodeExtent,
          nodeOrigin,
          onError
        });
        hasChange = hasChange || dragItem.position.x !== position.x || dragItem.position.y !== position.y;
        dragItem.position = position;
        dragItem.internals.positionAbsolute = positionAbsolute;
      }
      nodePositionsChanged = nodePositionsChanged || hasChange;
      if (!hasChange) {
        return;
      }
      updateNodePositions(dragItems, true);
      if (dragEvent && (onDrag || onNodeDrag || !nodeId && onSelectionDrag)) {
        const [currentNode, currentNodes] = getEventHandlerParams({
          nodeId,
          dragItems,
          nodeLookup
        });
        onDrag?.(dragEvent, dragItems, currentNode, currentNodes);
        onNodeDrag?.(dragEvent, currentNode, currentNodes);
        if (!nodeId) {
          onSelectionDrag?.(dragEvent, currentNodes);
        }
      }
    }
    async function autoPan() {
      if (!containerBounds) {
        return;
      }
      const { transform: transform2, panBy: panBy2, autoPanSpeed, autoPanOnNodeDrag } = getStoreItems();
      if (!autoPanOnNodeDrag) {
        autoPanStarted = false;
        cancelAnimationFrame(autoPanId);
        return;
      }
      const [xMovement, yMovement] = calcAutoPan(mousePosition, containerBounds, autoPanSpeed);
      if (xMovement !== 0 || yMovement !== 0) {
        lastPos.x = (lastPos.x ?? 0) - xMovement / transform2[2];
        lastPos.y = (lastPos.y ?? 0) - yMovement / transform2[2];
        if (await panBy2({ x: xMovement, y: yMovement })) {
          updateNodes(lastPos);
        }
      }
      autoPanId = requestAnimationFrame(autoPan);
    }
    function startDrag(event) {
      const { nodeLookup, multiSelectionActive, nodesDraggable, transform: transform2, snapGrid, snapToGrid, selectNodesOnDrag, onNodeDragStart, onSelectionDragStart, unselectNodesAndEdges } = getStoreItems();
      dragStarted = true;
      if ((!selectNodesOnDrag || !isSelectable) && !multiSelectionActive && nodeId) {
        if (!nodeLookup.get(nodeId)?.selected) {
          unselectNodesAndEdges();
        }
      }
      if (isSelectable && selectNodesOnDrag && nodeId) {
        onNodeMouseDown?.(nodeId);
      }
      const pointerPos = getPointerPosition(event.sourceEvent, { transform: transform2, snapGrid, snapToGrid, containerBounds });
      lastPos = pointerPos;
      dragItems = getDragItems(nodeLookup, nodesDraggable, pointerPos, nodeId);
      if (dragItems.size > 0 && (onDragStart || onNodeDragStart || !nodeId && onSelectionDragStart)) {
        const [currentNode, currentNodes] = getEventHandlerParams({
          nodeId,
          dragItems,
          nodeLookup
        });
        onDragStart?.(event.sourceEvent, dragItems, currentNode, currentNodes);
        onNodeDragStart?.(event.sourceEvent, currentNode, currentNodes);
        if (!nodeId) {
          onSelectionDragStart?.(event.sourceEvent, currentNodes);
        }
      }
    }
    const d3DragInstance = drag_default().clickDistance(nodeClickDistance).on("start", (event) => {
      const { domNode: domNode2, nodeDragThreshold, transform: transform2, snapGrid, snapToGrid } = getStoreItems();
      containerBounds = domNode2?.getBoundingClientRect() || null;
      abortDrag = false;
      nodePositionsChanged = false;
      dragEvent = event.sourceEvent;
      if (nodeDragThreshold === 0) {
        startDrag(event);
      }
      const pointerPos = getPointerPosition(event.sourceEvent, { transform: transform2, snapGrid, snapToGrid, containerBounds });
      lastPos = pointerPos;
      mousePosition = getEventPosition(event.sourceEvent, containerBounds);
    }).on("drag", (event) => {
      const { autoPanOnNodeDrag, transform: transform2, snapGrid, snapToGrid, nodeDragThreshold, nodeLookup } = getStoreItems();
      const pointerPos = getPointerPosition(event.sourceEvent, { transform: transform2, snapGrid, snapToGrid, containerBounds });
      dragEvent = event.sourceEvent;
      if (event.sourceEvent.type === "touchmove" && event.sourceEvent.touches.length > 1 || // if user deletes a node while dragging, we need to abort the drag to prevent errors
      nodeId && !nodeLookup.has(nodeId)) {
        abortDrag = true;
      }
      if (abortDrag) {
        return;
      }
      if (!autoPanStarted && autoPanOnNodeDrag && dragStarted) {
        autoPanStarted = true;
        autoPan();
      }
      if (!dragStarted) {
        const currentMousePosition = getEventPosition(event.sourceEvent, containerBounds);
        const x = currentMousePosition.x - mousePosition.x;
        const y = currentMousePosition.y - mousePosition.y;
        const distance2 = Math.sqrt(x * x + y * y);
        if (distance2 > nodeDragThreshold) {
          startDrag(event);
        }
      }
      if ((lastPos.x !== pointerPos.xSnapped || lastPos.y !== pointerPos.ySnapped) && dragItems && dragStarted) {
        mousePosition = getEventPosition(event.sourceEvent, containerBounds);
        updateNodes(pointerPos);
      }
    }).on("end", (event) => {
      if (!dragStarted || abortDrag) {
        return;
      }
      autoPanStarted = false;
      dragStarted = false;
      cancelAnimationFrame(autoPanId);
      if (dragItems.size > 0) {
        const { nodeLookup, updateNodePositions, onNodeDragStop, onSelectionDragStop } = getStoreItems();
        if (nodePositionsChanged) {
          updateNodePositions(dragItems, false);
          nodePositionsChanged = false;
        }
        if (onDragStop || onNodeDragStop || !nodeId && onSelectionDragStop) {
          const [currentNode, currentNodes] = getEventHandlerParams({
            nodeId,
            dragItems,
            nodeLookup,
            dragging: false
          });
          onDragStop?.(event.sourceEvent, dragItems, currentNode, currentNodes);
          onNodeDragStop?.(event.sourceEvent, currentNode, currentNodes);
          if (!nodeId) {
            onSelectionDragStop?.(event.sourceEvent, currentNodes);
          }
        }
      }
    }).filter((event) => {
      const target = event.target;
      const isDraggable = !event.button && (!noDragClassName || !hasSelector(target, `.${noDragClassName}`, domNode)) && (!handleSelector || hasSelector(target, handleSelector, domNode));
      return isDraggable;
    });
    d3Selection.call(d3DragInstance);
  }
  function destroy() {
    d3Selection?.on(".drag", null);
  }
  return {
    update,
    destroy
  };
}
function getNodesWithinDistance(position, nodeLookup, distance2) {
  const nodes = [];
  const rect = {
    x: position.x - distance2,
    y: position.y - distance2,
    width: distance2 * 2,
    height: distance2 * 2
  };
  for (const node of nodeLookup.values()) {
    if (getOverlappingArea(rect, nodeToRect(node)) > 0) {
      nodes.push(node);
    }
  }
  return nodes;
}
var ADDITIONAL_DISTANCE = 250;
function getClosestHandle(position, connectionRadius, nodeLookup, fromHandle) {
  let closestHandles = [];
  let minDistance = Infinity;
  const closeNodes = getNodesWithinDistance(position, nodeLookup, connectionRadius + ADDITIONAL_DISTANCE);
  for (const node of closeNodes) {
    const allHandles = [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
    for (const handle of allHandles) {
      if (fromHandle.nodeId === handle.nodeId && fromHandle.type === handle.type && fromHandle.id === handle.id) {
        continue;
      }
      const { x, y } = getHandlePosition(node, handle, handle.position, true);
      const distance2 = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (distance2 > connectionRadius) {
        continue;
      }
      if (distance2 < minDistance) {
        closestHandles = [{ ...handle, x, y }];
        minDistance = distance2;
      } else if (distance2 === minDistance) {
        closestHandles.push({ ...handle, x, y });
      }
    }
  }
  if (!closestHandles.length) {
    return null;
  }
  if (closestHandles.length > 1) {
    const oppositeHandleType = fromHandle.type === "source" ? "target" : "source";
    return closestHandles.find((handle) => handle.type === oppositeHandleType) ?? closestHandles[0];
  }
  return closestHandles[0];
}
function getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode, withAbsolutePosition = false) {
  const node = nodeLookup.get(nodeId);
  if (!node) {
    return null;
  }
  const handles = connectionMode === "strict" ? node.internals.handleBounds?.[handleType] : [...node.internals.handleBounds?.source ?? [], ...node.internals.handleBounds?.target ?? []];
  const handle = (handleId ? handles?.find((h) => h.id === handleId) : handles?.[0]) ?? null;
  return handle && withAbsolutePosition ? { ...handle, ...getHandlePosition(node, handle, handle.position, true) } : handle;
}
function getHandleType(edgeUpdaterType, handleDomNode) {
  if (edgeUpdaterType) {
    return edgeUpdaterType;
  } else if (handleDomNode?.classList.contains("target")) {
    return "target";
  } else if (handleDomNode?.classList.contains("source")) {
    return "source";
  }
  return null;
}
function isConnectionValid(isInsideConnectionRadius, isHandleValid) {
  let isValid = null;
  if (isHandleValid) {
    isValid = true;
  } else if (isInsideConnectionRadius && !isHandleValid) {
    isValid = false;
  }
  return isValid;
}
var alwaysValid = () => true;
function onPointerDown(event, { connectionMode, connectionRadius, handleId, nodeId, edgeUpdaterType, isTarget, domNode, nodeLookup, lib, autoPanOnConnect, flowId, panBy: panBy2, cancelConnection, onConnectStart, onConnect, onConnectEnd, isValidConnection = alwaysValid, onReconnectEnd, updateConnection, getTransform, getFromHandle, autoPanSpeed, dragThreshold = 1, handleDomNode }) {
  const doc = getHostForElement(event.target);
  let autoPanId = 0;
  let closestHandle;
  const { x, y } = getEventPosition(event);
  const handleType = getHandleType(edgeUpdaterType, handleDomNode);
  const containerBounds = domNode?.getBoundingClientRect();
  let connectionStarted = false;
  if (!containerBounds || !handleType) {
    return;
  }
  const fromHandleInternal = getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode);
  if (!fromHandleInternal) {
    return;
  }
  let position = getEventPosition(event, containerBounds);
  let autoPanStarted = false;
  let connection = null;
  let isValid = false;
  let resultHandleDomNode = null;
  function autoPan() {
    if (!autoPanOnConnect || !containerBounds) {
      return;
    }
    const [x2, y2] = calcAutoPan(position, containerBounds, autoPanSpeed);
    panBy2({ x: x2, y: y2 });
    autoPanId = requestAnimationFrame(autoPan);
  }
  const fromHandle = {
    ...fromHandleInternal,
    nodeId,
    type: handleType,
    position: fromHandleInternal.position
  };
  const fromInternalNode = nodeLookup.get(nodeId);
  const from = getHandlePosition(fromInternalNode, fromHandle, Position.Left, true);
  let previousConnection = {
    inProgress: true,
    isValid: null,
    from,
    fromHandle,
    fromPosition: fromHandle.position,
    fromNode: fromInternalNode,
    to: position,
    toHandle: null,
    toPosition: oppositePosition[fromHandle.position],
    toNode: null,
    pointer: position
  };
  function startConnection() {
    connectionStarted = true;
    updateConnection(previousConnection);
    onConnectStart?.(event, { nodeId, handleId, handleType });
  }
  if (dragThreshold === 0) {
    startConnection();
  }
  function onPointerMove(event2) {
    if (!connectionStarted) {
      const { x: evtX, y: evtY } = getEventPosition(event2);
      const dx = evtX - x;
      const dy = evtY - y;
      const nextConnectionStarted = dx * dx + dy * dy > dragThreshold * dragThreshold;
      if (!nextConnectionStarted) {
        return;
      }
      startConnection();
    }
    if (!getFromHandle() || !fromHandle) {
      onPointerUp(event2);
      return;
    }
    const transform2 = getTransform();
    position = getEventPosition(event2, containerBounds);
    closestHandle = getClosestHandle(pointToRendererPoint(position, transform2, false, [1, 1]), connectionRadius, nodeLookup, fromHandle);
    if (!autoPanStarted) {
      autoPan();
      autoPanStarted = true;
    }
    const result = isValidHandle(event2, {
      handle: closestHandle,
      connectionMode,
      fromNodeId: nodeId,
      fromHandleId: handleId,
      fromType: isTarget ? "target" : "source",
      isValidConnection,
      doc,
      lib,
      flowId,
      nodeLookup
    });
    resultHandleDomNode = result.handleDomNode;
    connection = result.connection;
    isValid = isConnectionValid(!!closestHandle, result.isValid);
    const fromInternalNode2 = nodeLookup.get(nodeId);
    const from2 = fromInternalNode2 ? getHandlePosition(fromInternalNode2, fromHandle, Position.Left, true) : previousConnection.from;
    const newConnection = {
      ...previousConnection,
      from: from2,
      isValid,
      to: result.toHandle && isValid ? rendererPointToPoint({ x: result.toHandle.x, y: result.toHandle.y }, transform2) : position,
      toHandle: result.toHandle,
      toPosition: isValid && result.toHandle ? result.toHandle.position : oppositePosition[fromHandle.position],
      toNode: result.toHandle ? nodeLookup.get(result.toHandle.nodeId) : null,
      pointer: position
    };
    updateConnection(newConnection);
    previousConnection = newConnection;
  }
  function onPointerUp(event2) {
    if ("touches" in event2 && event2.touches.length > 0) {
      return;
    }
    if (connectionStarted) {
      if ((closestHandle || resultHandleDomNode) && connection && isValid) {
        onConnect?.(connection);
      }
      const { inProgress, ...connectionState } = previousConnection;
      const finalConnectionState = {
        ...connectionState,
        toPosition: previousConnection.toHandle ? previousConnection.toPosition : null
      };
      onConnectEnd?.(event2, finalConnectionState);
      if (edgeUpdaterType) {
        onReconnectEnd?.(event2, finalConnectionState);
      }
    }
    cancelConnection();
    cancelAnimationFrame(autoPanId);
    autoPanStarted = false;
    isValid = false;
    connection = null;
    resultHandleDomNode = null;
    doc.removeEventListener("mousemove", onPointerMove);
    doc.removeEventListener("mouseup", onPointerUp);
    doc.removeEventListener("touchmove", onPointerMove);
    doc.removeEventListener("touchend", onPointerUp);
  }
  doc.addEventListener("mousemove", onPointerMove);
  doc.addEventListener("mouseup", onPointerUp);
  doc.addEventListener("touchmove", onPointerMove);
  doc.addEventListener("touchend", onPointerUp);
}
function isValidHandle(event, { handle, connectionMode, fromNodeId, fromHandleId, fromType, doc, lib, flowId, isValidConnection = alwaysValid, nodeLookup }) {
  const isTarget = fromType === "target";
  const handleDomNode = handle ? doc.querySelector(`.${lib}-flow__handle[data-id="${flowId}-${handle?.nodeId}-${handle?.id}-${handle?.type}"]`) : null;
  const { x, y } = getEventPosition(event);
  const handleBelow = doc.elementFromPoint(x, y);
  const handleToCheck = handleBelow?.classList.contains(`${lib}-flow__handle`) ? handleBelow : handleDomNode;
  const result = {
    handleDomNode: handleToCheck,
    isValid: false,
    connection: null,
    toHandle: null
  };
  if (handleToCheck) {
    const handleType = getHandleType(void 0, handleToCheck);
    const handleNodeId = handleToCheck.getAttribute("data-nodeid");
    const handleId = handleToCheck.getAttribute("data-handleid");
    const connectable = handleToCheck.classList.contains("connectable");
    const connectableEnd = handleToCheck.classList.contains("connectableend");
    if (!handleNodeId || !handleType) {
      return result;
    }
    const connection = {
      source: isTarget ? handleNodeId : fromNodeId,
      sourceHandle: isTarget ? handleId : fromHandleId,
      target: isTarget ? fromNodeId : handleNodeId,
      targetHandle: isTarget ? fromHandleId : handleId
    };
    result.connection = connection;
    const isConnectable = connectable && connectableEnd;
    const isValid = isConnectable && (connectionMode === ConnectionMode.Strict ? isTarget && handleType === "source" || !isTarget && handleType === "target" : handleNodeId !== fromNodeId || handleId !== fromHandleId);
    result.isValid = isValid && isValidConnection(connection);
    result.toHandle = getHandle(handleNodeId, handleType, handleId, nodeLookup, connectionMode, true);
  }
  return result;
}
var XYHandle = {
  onPointerDown,
  isValid: isValidHandle
};
function XYMinimap({ domNode, panZoom, getTransform, getViewScale }) {
  const selection2 = select_default2(domNode);
  function update({ translateExtent, width, height, zoomStep = 1, pannable = true, zoomable = true, inversePan = false }) {
    const zoomHandler = (event) => {
      if (event.sourceEvent.type !== "wheel" || !panZoom) {
        return;
      }
      const transform2 = getTransform();
      const factor = event.sourceEvent.ctrlKey && isMacOs() ? 10 : 1;
      const pinchDelta = -event.sourceEvent.deltaY * (event.sourceEvent.deltaMode === 1 ? 0.05 : event.sourceEvent.deltaMode ? 1 : 2e-3) * zoomStep;
      const nextZoom = transform2[2] * Math.pow(2, pinchDelta * factor);
      panZoom.scaleTo(nextZoom);
    };
    let panStart = [0, 0];
    const panStartHandler = (event) => {
      if (event.sourceEvent.type === "mousedown" || event.sourceEvent.type === "touchstart") {
        panStart = [
          event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX,
          event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY
        ];
      }
    };
    const panHandler = (event) => {
      const transform2 = getTransform();
      if (event.sourceEvent.type !== "mousemove" && event.sourceEvent.type !== "touchmove" || !panZoom) {
        return;
      }
      const panCurrent = [
        event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX,
        event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY
      ];
      const panDelta = [panCurrent[0] - panStart[0], panCurrent[1] - panStart[1]];
      panStart = panCurrent;
      const moveScale = getViewScale() * Math.max(transform2[2], Math.log(transform2[2])) * (inversePan ? -1 : 1);
      const position = {
        x: transform2[0] - panDelta[0] * moveScale,
        y: transform2[1] - panDelta[1] * moveScale
      };
      const extent = [
        [0, 0],
        [width, height]
      ];
      panZoom.setViewportConstrained({
        x: position.x,
        y: position.y,
        zoom: transform2[2]
      }, extent, translateExtent);
    };
    const zoomAndPanHandler = zoom_default2().on("start", panStartHandler).on("zoom", pannable ? panHandler : null).on("zoom.wheel", zoomable ? zoomHandler : null);
    selection2.call(zoomAndPanHandler, {});
  }
  function destroy() {
    selection2.on("zoom", null);
  }
  return {
    update,
    destroy,
    pointer: pointer_default
  };
}
var transformToViewport = (transform2) => ({
  x: transform2.x,
  y: transform2.y,
  zoom: transform2.k
});
var viewportToTransform = ({ x, y, zoom }) => identity2.translate(x, y).scale(zoom);
var isWrappedWithClass = (event, className) => event.target.closest(`.${className}`);
var isRightClickPan = (panOnDrag, usedButton) => usedButton === 2 && Array.isArray(panOnDrag) && panOnDrag.includes(2);
var defaultEase = (t) => ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
var getD3Transition = (selection2, duration = 0, ease = defaultEase, onEnd = () => {
}) => {
  const hasDuration = typeof duration === "number" && duration > 0;
  if (!hasDuration) {
    onEnd();
  }
  return hasDuration ? selection2.transition().duration(duration).ease(ease).on("end", onEnd) : selection2;
};
var wheelDelta = (event) => {
  const factor = event.ctrlKey && isMacOs() ? 10 : 1;
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 2e-3) * factor;
};
function createPanOnScrollHandler({ zoomPanValues, noWheelClassName, d3Selection, d3Zoom, panOnScrollMode, panOnScrollSpeed, zoomOnPinch, onPanZoomStart, onPanZoom, onPanZoomEnd }) {
  return (event) => {
    if (isWrappedWithClass(event, noWheelClassName)) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
      return false;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const currentZoom = d3Selection.property("__zoom").k || 1;
    if (event.ctrlKey && zoomOnPinch) {
      const point = pointer_default(event);
      const pinchDelta = wheelDelta(event);
      const zoom = currentZoom * Math.pow(2, pinchDelta);
      d3Zoom.scaleTo(d3Selection, zoom, point, event);
      return;
    }
    const deltaNormalize = event.deltaMode === 1 ? 20 : 1;
    let deltaX = panOnScrollMode === PanOnScrollMode.Vertical ? 0 : event.deltaX * deltaNormalize;
    let deltaY = panOnScrollMode === PanOnScrollMode.Horizontal ? 0 : event.deltaY * deltaNormalize;
    if (!isMacOs() && event.shiftKey && panOnScrollMode !== PanOnScrollMode.Vertical) {
      deltaX = event.deltaY * deltaNormalize;
      deltaY = 0;
    }
    d3Zoom.translateBy(
      d3Selection,
      -(deltaX / currentZoom) * panOnScrollSpeed,
      -(deltaY / currentZoom) * panOnScrollSpeed,
      // @ts-ignore
      { internal: true }
    );
    const nextViewport = transformToViewport(d3Selection.property("__zoom"));
    clearTimeout(zoomPanValues.panScrollTimeout);
    if (!zoomPanValues.isPanScrolling) {
      zoomPanValues.isPanScrolling = true;
      onPanZoomStart?.(event, nextViewport);
    } else {
      onPanZoom?.(event, nextViewport);
      zoomPanValues.panScrollTimeout = setTimeout(() => {
        onPanZoomEnd?.(event, nextViewport);
        zoomPanValues.isPanScrolling = false;
      }, 150);
    }
  };
}
function createZoomOnScrollHandler({ noWheelClassName, preventScrolling, d3ZoomHandler }) {
  return function(event, d) {
    const isWheel = event.type === "wheel";
    const preventZoom = !preventScrolling && isWheel && !event.ctrlKey;
    const hasNoWheelClass = isWrappedWithClass(event, noWheelClassName);
    if (event.ctrlKey && isWheel && hasNoWheelClass) {
      event.preventDefault();
    }
    if (preventZoom || hasNoWheelClass) {
      return null;
    }
    event.preventDefault();
    d3ZoomHandler.call(this, event, d);
  };
}
function createPanZoomStartHandler({ zoomPanValues, onDraggingChange, onPanZoomStart }) {
  return (event) => {
    if (event.sourceEvent?.internal) {
      return;
    }
    const viewport = transformToViewport(event.transform);
    zoomPanValues.mouseButton = event.sourceEvent?.button || 0;
    zoomPanValues.isZoomingOrPanning = true;
    zoomPanValues.prevViewport = viewport;
    if (event.sourceEvent?.type === "mousedown") {
      onDraggingChange(true);
    }
    if (onPanZoomStart) {
      onPanZoomStart?.(event.sourceEvent, viewport);
    }
  };
}
function createPanZoomHandler({ zoomPanValues, panOnDrag, onPaneContextMenu, onTransformChange, onPanZoom }) {
  return (event) => {
    zoomPanValues.usedRightMouseButton = !!(onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0));
    if (!event.sourceEvent?.sync) {
      onTransformChange([event.transform.x, event.transform.y, event.transform.k]);
    }
    if (onPanZoom && !event.sourceEvent?.internal) {
      onPanZoom?.(event.sourceEvent, transformToViewport(event.transform));
    }
  };
}
function createPanZoomEndHandler({ zoomPanValues, panOnDrag, panOnScroll, onDraggingChange, onPanZoomEnd, onPaneContextMenu }) {
  return (event) => {
    if (event.sourceEvent?.internal) {
      return;
    }
    zoomPanValues.isZoomingOrPanning = false;
    if (onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0) && !zoomPanValues.usedRightMouseButton && event.sourceEvent) {
      onPaneContextMenu(event.sourceEvent);
    }
    zoomPanValues.usedRightMouseButton = false;
    onDraggingChange(false);
    if (onPanZoomEnd) {
      const viewport = transformToViewport(event.transform);
      zoomPanValues.prevViewport = viewport;
      clearTimeout(zoomPanValues.timerId);
      zoomPanValues.timerId = setTimeout(
        () => {
          onPanZoomEnd?.(event.sourceEvent, viewport);
        },
        // we need a setTimeout for panOnScroll to supress multiple end events fired during scroll
        panOnScroll ? 150 : 0
      );
    }
  };
}
function createFilter({ zoomActivationKeyPressed, zoomOnScroll, zoomOnPinch, panOnDrag, panOnScroll, zoomOnDoubleClick, userSelectionActive, noWheelClassName, noPanClassName, lib, connectionInProgress }) {
  return (event) => {
    const zoomScroll = zoomActivationKeyPressed || zoomOnScroll;
    const pinchZoom = zoomOnPinch && event.ctrlKey;
    const isWheelEvent = event.type === "wheel";
    if (event.button === 1 && event.type === "mousedown" && (isWrappedWithClass(event, `${lib}-flow__node`) || isWrappedWithClass(event, `${lib}-flow__edge`))) {
      return true;
    }
    if (!panOnDrag && !zoomScroll && !panOnScroll && !zoomOnDoubleClick && !zoomOnPinch) {
      return false;
    }
    if (userSelectionActive) {
      return false;
    }
    if (connectionInProgress && !isWheelEvent) {
      return false;
    }
    if (isWrappedWithClass(event, noWheelClassName) && isWheelEvent) {
      return false;
    }
    if (isWrappedWithClass(event, noPanClassName) && (!isWheelEvent || panOnScroll && isWheelEvent && !zoomActivationKeyPressed)) {
      return false;
    }
    if (!zoomOnPinch && event.ctrlKey && isWheelEvent) {
      return false;
    }
    if (!zoomOnPinch && event.type === "touchstart" && event.touches?.length > 1) {
      event.preventDefault();
      return false;
    }
    if (!zoomScroll && !panOnScroll && !pinchZoom && isWheelEvent) {
      return false;
    }
    if (!panOnDrag && (event.type === "mousedown" || event.type === "touchstart")) {
      return false;
    }
    if (Array.isArray(panOnDrag) && !panOnDrag.includes(event.button) && event.type === "mousedown") {
      return false;
    }
    const buttonAllowed = Array.isArray(panOnDrag) && panOnDrag.includes(event.button) || !event.button || event.button <= 1;
    return (!event.ctrlKey || isWheelEvent) && buttonAllowed;
  };
}
function XYPanZoom({ domNode, minZoom, maxZoom, translateExtent, viewport, onPanZoom, onPanZoomStart, onPanZoomEnd, onDraggingChange }) {
  const zoomPanValues = {
    isZoomingOrPanning: false,
    usedRightMouseButton: false,
    prevViewport: { x: 0, y: 0, zoom: 0 },
    mouseButton: 0,
    timerId: void 0,
    panScrollTimeout: void 0,
    isPanScrolling: false
  };
  const bbox = domNode.getBoundingClientRect();
  const d3ZoomInstance = zoom_default2().scaleExtent([minZoom, maxZoom]).translateExtent(translateExtent);
  const d3Selection = select_default2(domNode).call(d3ZoomInstance);
  setViewportConstrained({
    x: viewport.x,
    y: viewport.y,
    zoom: clamp(viewport.zoom, minZoom, maxZoom)
  }, [
    [0, 0],
    [bbox.width, bbox.height]
  ], translateExtent);
  const d3ZoomHandler = d3Selection.on("wheel.zoom");
  const d3DblClickZoomHandler = d3Selection.on("dblclick.zoom");
  d3ZoomInstance.wheelDelta(wheelDelta);
  function setTransform(transform2, options) {
    if (d3Selection) {
      return new Promise((resolve) => {
        d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default).transform(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), transform2);
      });
    }
    return Promise.resolve(false);
  }
  function update({ noWheelClassName, noPanClassName, onPaneContextMenu, userSelectionActive, panOnScroll, panOnDrag, panOnScrollMode, panOnScrollSpeed, preventScrolling, zoomOnPinch, zoomOnScroll, zoomOnDoubleClick, zoomActivationKeyPressed, lib, onTransformChange, connectionInProgress, paneClickDistance, selectionOnDrag }) {
    if (userSelectionActive && !zoomPanValues.isZoomingOrPanning) {
      destroy();
    }
    const isPanOnScroll = panOnScroll && !zoomActivationKeyPressed && !userSelectionActive;
    d3ZoomInstance.clickDistance(selectionOnDrag ? Infinity : !isNumeric(paneClickDistance) || paneClickDistance < 0 ? 0 : paneClickDistance);
    const wheelHandler = isPanOnScroll ? createPanOnScrollHandler({
      zoomPanValues,
      noWheelClassName,
      d3Selection,
      d3Zoom: d3ZoomInstance,
      panOnScrollMode,
      panOnScrollSpeed,
      zoomOnPinch,
      onPanZoomStart,
      onPanZoom,
      onPanZoomEnd
    }) : createZoomOnScrollHandler({
      noWheelClassName,
      preventScrolling,
      d3ZoomHandler
    });
    d3Selection.on("wheel.zoom", wheelHandler, { passive: false });
    if (!userSelectionActive) {
      const startHandler = createPanZoomStartHandler({
        zoomPanValues,
        onDraggingChange,
        onPanZoomStart
      });
      d3ZoomInstance.on("start", startHandler);
      const panZoomHandler = createPanZoomHandler({
        zoomPanValues,
        panOnDrag,
        onPaneContextMenu: !!onPaneContextMenu,
        onPanZoom,
        onTransformChange
      });
      d3ZoomInstance.on("zoom", panZoomHandler);
      const panZoomEndHandler = createPanZoomEndHandler({
        zoomPanValues,
        panOnDrag,
        panOnScroll,
        onPaneContextMenu,
        onPanZoomEnd,
        onDraggingChange
      });
      d3ZoomInstance.on("end", panZoomEndHandler);
    }
    const filter2 = createFilter({
      zoomActivationKeyPressed,
      panOnDrag,
      zoomOnScroll,
      panOnScroll,
      zoomOnDoubleClick,
      zoomOnPinch,
      userSelectionActive,
      noPanClassName,
      noWheelClassName,
      lib,
      connectionInProgress
    });
    d3ZoomInstance.filter(filter2);
    if (zoomOnDoubleClick) {
      d3Selection.on("dblclick.zoom", d3DblClickZoomHandler);
    } else {
      d3Selection.on("dblclick.zoom", null);
    }
  }
  function destroy() {
    d3ZoomInstance.on("zoom", null);
  }
  async function setViewportConstrained(viewport2, extent, translateExtent2) {
    const nextTransform = viewportToTransform(viewport2);
    const contrainedTransform = d3ZoomInstance?.constrain()(nextTransform, extent, translateExtent2);
    if (contrainedTransform) {
      await setTransform(contrainedTransform);
    }
    return new Promise((resolve) => resolve(contrainedTransform));
  }
  async function setViewport(viewport2, options) {
    const nextTransform = viewportToTransform(viewport2);
    await setTransform(nextTransform, options);
    return new Promise((resolve) => resolve(nextTransform));
  }
  function syncViewport(viewport2) {
    if (d3Selection) {
      const nextTransform = viewportToTransform(viewport2);
      const currentTransform = d3Selection.property("__zoom");
      if (currentTransform.k !== viewport2.zoom || currentTransform.x !== viewport2.x || currentTransform.y !== viewport2.y) {
        d3ZoomInstance?.transform(d3Selection, nextTransform, null, { sync: true });
      }
    }
  }
  function getViewport() {
    const transform2 = d3Selection ? transform(d3Selection.node()) : { x: 0, y: 0, k: 1 };
    return { x: transform2.x, y: transform2.y, zoom: transform2.k };
  }
  function scaleTo(zoom, options) {
    if (d3Selection) {
      return new Promise((resolve) => {
        d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default).scaleTo(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), zoom);
      });
    }
    return Promise.resolve(false);
  }
  function scaleBy(factor, options) {
    if (d3Selection) {
      return new Promise((resolve) => {
        d3ZoomInstance?.interpolate(options?.interpolate === "linear" ? value_default : zoom_default).scaleBy(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), factor);
      });
    }
    return Promise.resolve(false);
  }
  function setScaleExtent(scaleExtent) {
    d3ZoomInstance?.scaleExtent(scaleExtent);
  }
  function setTranslateExtent(translateExtent2) {
    d3ZoomInstance?.translateExtent(translateExtent2);
  }
  function setClickDistance(distance2) {
    const validDistance = !isNumeric(distance2) || distance2 < 0 ? 0 : distance2;
    d3ZoomInstance?.clickDistance(validDistance);
  }
  return {
    update,
    destroy,
    setViewport,
    setViewportConstrained,
    getViewport,
    scaleTo,
    scaleBy,
    setScaleExtent,
    setTranslateExtent,
    syncViewport,
    setClickDistance
  };
}
var ResizeControlVariant;
(function(ResizeControlVariant2) {
  ResizeControlVariant2["Line"] = "line";
  ResizeControlVariant2["Handle"] = "handle";
})(ResizeControlVariant || (ResizeControlVariant = {}));
function getResizeDirection({ width, prevWidth, height, prevHeight, affectsX, affectsY }) {
  const deltaWidth = width - prevWidth;
  const deltaHeight = height - prevHeight;
  const direction = [deltaWidth > 0 ? 1 : deltaWidth < 0 ? -1 : 0, deltaHeight > 0 ? 1 : deltaHeight < 0 ? -1 : 0];
  if (deltaWidth && affectsX) {
    direction[0] = direction[0] * -1;
  }
  if (deltaHeight && affectsY) {
    direction[1] = direction[1] * -1;
  }
  return direction;
}
function getControlDirection(controlPosition) {
  const isHorizontal = controlPosition.includes("right") || controlPosition.includes("left");
  const isVertical = controlPosition.includes("bottom") || controlPosition.includes("top");
  const affectsX = controlPosition.includes("left");
  const affectsY = controlPosition.includes("top");
  return {
    isHorizontal,
    isVertical,
    affectsX,
    affectsY
  };
}
function getLowerExtentClamp(lowerExtent, lowerBound) {
  return Math.max(0, lowerBound - lowerExtent);
}
function getUpperExtentClamp(upperExtent, upperBound) {
  return Math.max(0, upperExtent - upperBound);
}
function getSizeClamp(size, minSize, maxSize) {
  return Math.max(0, minSize - size, size - maxSize);
}
function xor(a, b) {
  return a ? !b : b;
}
function getDimensionsAfterResize(startValues, controlDirection, pointerPosition, boundaries, keepAspectRatio, nodeOrigin, extent, childExtent) {
  let { affectsX, affectsY } = controlDirection;
  const { isHorizontal, isVertical } = controlDirection;
  const isDiagonal = isHorizontal && isVertical;
  const { xSnapped, ySnapped } = pointerPosition;
  const { minWidth, maxWidth, minHeight, maxHeight } = boundaries;
  const { x: startX, y: startY, width: startWidth, height: startHeight, aspectRatio } = startValues;
  let distX = Math.floor(isHorizontal ? xSnapped - startValues.pointerX : 0);
  let distY = Math.floor(isVertical ? ySnapped - startValues.pointerY : 0);
  const newWidth = startWidth + (affectsX ? -distX : distX);
  const newHeight = startHeight + (affectsY ? -distY : distY);
  const originOffsetX = -nodeOrigin[0] * startWidth;
  const originOffsetY = -nodeOrigin[1] * startHeight;
  let clampX = getSizeClamp(newWidth, minWidth, maxWidth);
  let clampY = getSizeClamp(newHeight, minHeight, maxHeight);
  if (extent) {
    let xExtentClamp = 0;
    let yExtentClamp = 0;
    if (affectsX && distX < 0) {
      xExtentClamp = getLowerExtentClamp(startX + distX + originOffsetX, extent[0][0]);
    } else if (!affectsX && distX > 0) {
      xExtentClamp = getUpperExtentClamp(startX + newWidth + originOffsetX, extent[1][0]);
    }
    if (affectsY && distY < 0) {
      yExtentClamp = getLowerExtentClamp(startY + distY + originOffsetY, extent[0][1]);
    } else if (!affectsY && distY > 0) {
      yExtentClamp = getUpperExtentClamp(startY + newHeight + originOffsetY, extent[1][1]);
    }
    clampX = Math.max(clampX, xExtentClamp);
    clampY = Math.max(clampY, yExtentClamp);
  }
  if (childExtent) {
    let xExtentClamp = 0;
    let yExtentClamp = 0;
    if (affectsX && distX > 0) {
      xExtentClamp = getUpperExtentClamp(startX + distX, childExtent[0][0]);
    } else if (!affectsX && distX < 0) {
      xExtentClamp = getLowerExtentClamp(startX + newWidth, childExtent[1][0]);
    }
    if (affectsY && distY > 0) {
      yExtentClamp = getUpperExtentClamp(startY + distY, childExtent[0][1]);
    } else if (!affectsY && distY < 0) {
      yExtentClamp = getLowerExtentClamp(startY + newHeight, childExtent[1][1]);
    }
    clampX = Math.max(clampX, xExtentClamp);
    clampY = Math.max(clampY, yExtentClamp);
  }
  if (keepAspectRatio) {
    if (isHorizontal) {
      const aspectHeightClamp = getSizeClamp(newWidth / aspectRatio, minHeight, maxHeight) * aspectRatio;
      clampX = Math.max(clampX, aspectHeightClamp);
      if (extent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) {
          aspectExtentClamp = getUpperExtentClamp(startY + originOffsetY + newWidth / aspectRatio, extent[1][1]) * aspectRatio;
        } else {
          aspectExtentClamp = getLowerExtentClamp(startY + originOffsetY + (affectsX ? distX : -distX) / aspectRatio, extent[0][1]) * aspectRatio;
        }
        clampX = Math.max(clampX, aspectExtentClamp);
      }
      if (childExtent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsX && !affectsY && isDiagonal) {
          aspectExtentClamp = getLowerExtentClamp(startY + newWidth / aspectRatio, childExtent[1][1]) * aspectRatio;
        } else {
          aspectExtentClamp = getUpperExtentClamp(startY + (affectsX ? distX : -distX) / aspectRatio, childExtent[0][1]) * aspectRatio;
        }
        clampX = Math.max(clampX, aspectExtentClamp);
      }
    }
    if (isVertical) {
      const aspectWidthClamp = getSizeClamp(newHeight * aspectRatio, minWidth, maxWidth) / aspectRatio;
      clampY = Math.max(clampY, aspectWidthClamp);
      if (extent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) {
          aspectExtentClamp = getUpperExtentClamp(startX + newHeight * aspectRatio + originOffsetX, extent[1][0]) / aspectRatio;
        } else {
          aspectExtentClamp = getLowerExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio + originOffsetX, extent[0][0]) / aspectRatio;
        }
        clampY = Math.max(clampY, aspectExtentClamp);
      }
      if (childExtent) {
        let aspectExtentClamp = 0;
        if (!affectsX && !affectsY || affectsY && !affectsX && isDiagonal) {
          aspectExtentClamp = getLowerExtentClamp(startX + newHeight * aspectRatio, childExtent[1][0]) / aspectRatio;
        } else {
          aspectExtentClamp = getUpperExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio, childExtent[0][0]) / aspectRatio;
        }
        clampY = Math.max(clampY, aspectExtentClamp);
      }
    }
  }
  distY = distY + (distY < 0 ? clampY : -clampY);
  distX = distX + (distX < 0 ? clampX : -clampX);
  if (keepAspectRatio) {
    if (isDiagonal) {
      if (newWidth > newHeight * aspectRatio) {
        distY = (xor(affectsX, affectsY) ? -distX : distX) / aspectRatio;
      } else {
        distX = (xor(affectsX, affectsY) ? -distY : distY) * aspectRatio;
      }
    } else {
      if (isHorizontal) {
        distY = distX / aspectRatio;
        affectsY = affectsX;
      } else {
        distX = distY * aspectRatio;
        affectsX = affectsY;
      }
    }
  }
  const x = affectsX ? startX + distX : startX;
  const y = affectsY ? startY + distY : startY;
  return {
    width: startWidth + (affectsX ? -distX : distX),
    height: startHeight + (affectsY ? -distY : distY),
    x: nodeOrigin[0] * distX * (!affectsX ? 1 : -1) + x,
    y: nodeOrigin[1] * distY * (!affectsY ? 1 : -1) + y
  };
}
var initPrevValues = { width: 0, height: 0, x: 0, y: 0 };
var initStartValues = {
  ...initPrevValues,
  pointerX: 0,
  pointerY: 0,
  aspectRatio: 1
};
function nodeToParentExtent(node) {
  return [
    [0, 0],
    [node.measured.width, node.measured.height]
  ];
}
function nodeToChildExtent(child, parent, nodeOrigin) {
  const x = parent.position.x + child.position.x;
  const y = parent.position.y + child.position.y;
  const width = child.measured.width ?? 0;
  const height = child.measured.height ?? 0;
  const originOffsetX = nodeOrigin[0] * width;
  const originOffsetY = nodeOrigin[1] * height;
  return [
    [x - originOffsetX, y - originOffsetY],
    [x + width - originOffsetX, y + height - originOffsetY]
  ];
}
function XYResizer({ domNode, nodeId, getStoreItems, onChange, onEnd }) {
  const selection2 = select_default2(domNode);
  let params = {
    controlDirection: getControlDirection("bottom-right"),
    boundaries: {
      minWidth: 0,
      minHeight: 0,
      maxWidth: Number.MAX_VALUE,
      maxHeight: Number.MAX_VALUE
    },
    resizeDirection: void 0,
    keepAspectRatio: false
  };
  function update({ controlPosition, boundaries, keepAspectRatio, resizeDirection, onResizeStart, onResize, onResizeEnd, shouldResize }) {
    let prevValues = { ...initPrevValues };
    let startValues = { ...initStartValues };
    params = {
      boundaries,
      resizeDirection,
      keepAspectRatio,
      controlDirection: getControlDirection(controlPosition)
    };
    let node = void 0;
    let containerBounds = null;
    let childNodes = [];
    let parentNode = void 0;
    let parentExtent = void 0;
    let childExtent = void 0;
    let resizeDetected = false;
    const dragHandler = drag_default().on("start", (event) => {
      const { nodeLookup, transform: transform2, snapGrid, snapToGrid, nodeOrigin, paneDomNode } = getStoreItems();
      node = nodeLookup.get(nodeId);
      if (!node) {
        return;
      }
      containerBounds = paneDomNode?.getBoundingClientRect() ?? null;
      const { xSnapped, ySnapped } = getPointerPosition(event.sourceEvent, {
        transform: transform2,
        snapGrid,
        snapToGrid,
        containerBounds
      });
      prevValues = {
        width: node.measured.width ?? 0,
        height: node.measured.height ?? 0,
        x: node.position.x ?? 0,
        y: node.position.y ?? 0
      };
      startValues = {
        ...prevValues,
        pointerX: xSnapped,
        pointerY: ySnapped,
        aspectRatio: prevValues.width / prevValues.height
      };
      parentNode = void 0;
      if (node.parentId && (node.extent === "parent" || node.expandParent)) {
        parentNode = nodeLookup.get(node.parentId);
        parentExtent = parentNode && node.extent === "parent" ? nodeToParentExtent(parentNode) : void 0;
      }
      childNodes = [];
      childExtent = void 0;
      for (const [childId, child] of nodeLookup) {
        if (child.parentId === nodeId) {
          childNodes.push({
            id: childId,
            position: { ...child.position },
            extent: child.extent
          });
          if (child.extent === "parent" || child.expandParent) {
            const extent = nodeToChildExtent(child, node, child.origin ?? nodeOrigin);
            if (childExtent) {
              childExtent = [
                [Math.min(extent[0][0], childExtent[0][0]), Math.min(extent[0][1], childExtent[0][1])],
                [Math.max(extent[1][0], childExtent[1][0]), Math.max(extent[1][1], childExtent[1][1])]
              ];
            } else {
              childExtent = extent;
            }
          }
        }
      }
      onResizeStart?.(event, { ...prevValues });
    }).on("drag", (event) => {
      const { transform: transform2, snapGrid, snapToGrid, nodeOrigin: storeNodeOrigin } = getStoreItems();
      const pointerPosition = getPointerPosition(event.sourceEvent, {
        transform: transform2,
        snapGrid,
        snapToGrid,
        containerBounds
      });
      const childChanges = [];
      if (!node) {
        return;
      }
      const { x: prevX, y: prevY, width: prevWidth, height: prevHeight } = prevValues;
      const change = {};
      const nodeOrigin = node.origin ?? storeNodeOrigin;
      const { width, height, x, y } = getDimensionsAfterResize(startValues, params.controlDirection, pointerPosition, params.boundaries, params.keepAspectRatio, nodeOrigin, parentExtent, childExtent);
      const isWidthChange = width !== prevWidth;
      const isHeightChange = height !== prevHeight;
      const isXPosChange = x !== prevX && isWidthChange;
      const isYPosChange = y !== prevY && isHeightChange;
      if (!isXPosChange && !isYPosChange && !isWidthChange && !isHeightChange) {
        return;
      }
      if (isXPosChange || isYPosChange || nodeOrigin[0] === 1 || nodeOrigin[1] === 1) {
        change.x = isXPosChange ? x : prevValues.x;
        change.y = isYPosChange ? y : prevValues.y;
        prevValues.x = change.x;
        prevValues.y = change.y;
        if (childNodes.length > 0) {
          const xChange = x - prevX;
          const yChange = y - prevY;
          for (const childNode of childNodes) {
            childNode.position = {
              x: childNode.position.x - xChange + nodeOrigin[0] * (width - prevWidth),
              y: childNode.position.y - yChange + nodeOrigin[1] * (height - prevHeight)
            };
            childChanges.push(childNode);
          }
        }
      }
      if (isWidthChange || isHeightChange) {
        change.width = isWidthChange && (!params.resizeDirection || params.resizeDirection === "horizontal") ? width : prevValues.width;
        change.height = isHeightChange && (!params.resizeDirection || params.resizeDirection === "vertical") ? height : prevValues.height;
        prevValues.width = change.width;
        prevValues.height = change.height;
      }
      if (parentNode && node.expandParent) {
        const xLimit = nodeOrigin[0] * (change.width ?? 0);
        if (change.x && change.x < xLimit) {
          prevValues.x = xLimit;
          startValues.x = startValues.x - (change.x - xLimit);
        }
        const yLimit = nodeOrigin[1] * (change.height ?? 0);
        if (change.y && change.y < yLimit) {
          prevValues.y = yLimit;
          startValues.y = startValues.y - (change.y - yLimit);
        }
      }
      const direction = getResizeDirection({
        width: prevValues.width,
        prevWidth,
        height: prevValues.height,
        prevHeight,
        affectsX: params.controlDirection.affectsX,
        affectsY: params.controlDirection.affectsY
      });
      const nextValues = { ...prevValues, direction };
      const callResize = shouldResize?.(event, nextValues);
      if (callResize === false) {
        return;
      }
      resizeDetected = true;
      onResize?.(event, nextValues);
      onChange(change, childChanges);
    }).on("end", (event) => {
      if (!resizeDetected) {
        return;
      }
      onResizeEnd?.(event, { ...prevValues });
      onEnd?.({ ...prevValues });
      resizeDetected = false;
    });
    selection2.call(dragHandler);
  }
  function destroy() {
    selection2.on(".drag", null);
  }
  return {
    update,
    destroy
  };
}

// node_modules/zustand/esm/traditional.mjs
var import_react5 = __toESM(require("react"), 1);
var import_with_selector = __toESM(require_with_selector(), 1);

// node_modules/zustand/esm/vanilla.mjs
var import_meta = {};
var createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState2 = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const destroy = () => {
    if ((import_meta.env ? import_meta.env.MODE : void 0) !== "production") {
      console.warn(
        "[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."
      );
    }
    listeners.clear();
  };
  const api = { setState, getState, getInitialState: getInitialState2, subscribe, destroy };
  const initialState = state = createState(setState, getState, api);
  return api;
};
var createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;

// node_modules/zustand/esm/traditional.mjs
var { useDebugValue } = import_react5.default;
var { useSyncExternalStoreWithSelector } = import_with_selector.default;
var identity3 = (arg) => arg;
function useStoreWithEqualityFn(api, selector = identity3, equalityFn) {
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getServerState || api.getInitialState,
    selector,
    equalityFn
  );
  useDebugValue(slice);
  return slice;
}
var createWithEqualityFnImpl = (createState, defaultEqualityFn) => {
  const api = createStore(createState);
  const useBoundStoreWithEqualityFn = (selector, equalityFn = defaultEqualityFn) => useStoreWithEqualityFn(api, selector, equalityFn);
  Object.assign(useBoundStoreWithEqualityFn, api);
  return useBoundStoreWithEqualityFn;
};
var createWithEqualityFn = (createState, defaultEqualityFn) => createState ? createWithEqualityFnImpl(createState, defaultEqualityFn) : createWithEqualityFnImpl;

// node_modules/zustand/esm/shallow.mjs
function shallow$1(objA, objB) {
  if (Object.is(objA, objB)) {
    return true;
  }
  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
    return false;
  }
  if (objA instanceof Map && objB instanceof Map) {
    if (objA.size !== objB.size) return false;
    for (const [key, value] of objA) {
      if (!Object.is(value, objB.get(key))) {
        return false;
      }
    }
    return true;
  }
  if (objA instanceof Set && objB instanceof Set) {
    if (objA.size !== objB.size) return false;
    for (const value of objA) {
      if (!objB.has(value)) {
        return false;
      }
    }
    return true;
  }
  const keysA = Object.keys(objA);
  if (keysA.length !== Object.keys(objB).length) {
    return false;
  }
  for (const keyA of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, keyA) || !Object.is(objA[keyA], objB[keyA])) {
      return false;
    }
  }
  return true;
}

// node_modules/@xyflow/react/dist/esm/index.js
var import_react_dom = require("react-dom");
var StoreContext = (0, import_react6.createContext)(null);
var Provider$1 = StoreContext.Provider;
var zustandErrorMessage = errorMessages["error001"]();
function useStore(selector, equalityFn) {
  const store = (0, import_react6.useContext)(StoreContext);
  if (store === null) {
    throw new Error(zustandErrorMessage);
  }
  return useStoreWithEqualityFn(store, selector, equalityFn);
}
function useStoreApi() {
  const store = (0, import_react6.useContext)(StoreContext);
  if (store === null) {
    throw new Error(zustandErrorMessage);
  }
  return (0, import_react6.useMemo)(() => ({
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe
  }), [store]);
}
var style = { display: "none" };
var ariaLiveStyle = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  border: 0,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0px, 0px, 0px, 0px)",
  clipPath: "inset(100%)"
};
var ARIA_NODE_DESC_KEY = "react-flow__node-desc";
var ARIA_EDGE_DESC_KEY = "react-flow__edge-desc";
var ARIA_LIVE_MESSAGE = "react-flow__aria-live";
var ariaLiveSelector = (s) => s.ariaLiveMessage;
var ariaLabelConfigSelector = (s) => s.ariaLabelConfig;
function AriaLiveMessage({ rfId }) {
  const ariaLiveMessage = useStore(ariaLiveSelector);
  return (0, import_jsx_runtime3.jsx)("div", { id: `${ARIA_LIVE_MESSAGE}-${rfId}`, "aria-live": "assertive", "aria-atomic": "true", style: ariaLiveStyle, children: ariaLiveMessage });
}
function A11yDescriptions({ rfId, disableKeyboardA11y }) {
  const ariaLabelConfig = useStore(ariaLabelConfigSelector);
  return (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [(0, import_jsx_runtime3.jsx)("div", { id: `${ARIA_NODE_DESC_KEY}-${rfId}`, style, children: disableKeyboardA11y ? ariaLabelConfig["node.a11yDescription.default"] : ariaLabelConfig["node.a11yDescription.keyboardDisabled"] }), (0, import_jsx_runtime3.jsx)("div", { id: `${ARIA_EDGE_DESC_KEY}-${rfId}`, style, children: ariaLabelConfig["edge.a11yDescription.default"] }), !disableKeyboardA11y && (0, import_jsx_runtime3.jsx)(AriaLiveMessage, { rfId })] });
}
var Panel = (0, import_react6.forwardRef)(({ position = "top-left", children: children2, className, style: style2, ...rest }, ref) => {
  const positionClasses = `${position}`.split("-");
  return (0, import_jsx_runtime3.jsx)("div", { className: cc(["react-flow__panel", className, ...positionClasses]), style: style2, ref, ...rest, children: children2 });
});
Panel.displayName = "Panel";
function Attribution({ proOptions, position = "bottom-right" }) {
  if (proOptions?.hideAttribution) {
    return null;
  }
  return (0, import_jsx_runtime3.jsx)(Panel, { position, className: "react-flow__attribution", "data-message": "Please only hide this attribution when you are subscribed to React Flow Pro: https://pro.reactflow.dev", children: (0, import_jsx_runtime3.jsx)("a", { href: "https://reactflow.dev", target: "_blank", rel: "noopener noreferrer", "aria-label": "React Flow attribution", children: "React Flow" }) });
}
var selector$m = (s) => {
  const selectedNodes = [];
  const selectedEdges = [];
  for (const [, node] of s.nodeLookup) {
    if (node.selected) {
      selectedNodes.push(node.internals.userNode);
    }
  }
  for (const [, edge] of s.edgeLookup) {
    if (edge.selected) {
      selectedEdges.push(edge);
    }
  }
  return { selectedNodes, selectedEdges };
};
var selectId = (obj) => obj.id;
function areEqual(a, b) {
  return shallow$1(a.selectedNodes.map(selectId), b.selectedNodes.map(selectId)) && shallow$1(a.selectedEdges.map(selectId), b.selectedEdges.map(selectId));
}
function SelectionListenerInner({ onSelectionChange }) {
  const store = useStoreApi();
  const { selectedNodes, selectedEdges } = useStore(selector$m, areEqual);
  (0, import_react6.useEffect)(() => {
    const params = { nodes: selectedNodes, edges: selectedEdges };
    onSelectionChange?.(params);
    store.getState().onSelectionChangeHandlers.forEach((fn) => fn(params));
  }, [selectedNodes, selectedEdges, onSelectionChange]);
  return null;
}
var changeSelector = (s) => !!s.onSelectionChangeHandlers;
function SelectionListener({ onSelectionChange }) {
  const storeHasSelectionChangeHandlers = useStore(changeSelector);
  if (onSelectionChange || storeHasSelectionChangeHandlers) {
    return (0, import_jsx_runtime3.jsx)(SelectionListenerInner, { onSelectionChange });
  }
  return null;
}
var defaultNodeOrigin = [0, 0];
var defaultViewport = { x: 0, y: 0, zoom: 1 };
var reactFlowFieldsToTrack = [
  "nodes",
  "edges",
  "defaultNodes",
  "defaultEdges",
  "onConnect",
  "onConnectStart",
  "onConnectEnd",
  "onClickConnectStart",
  "onClickConnectEnd",
  "nodesDraggable",
  "autoPanOnNodeFocus",
  "nodesConnectable",
  "nodesFocusable",
  "edgesFocusable",
  "edgesReconnectable",
  "elevateNodesOnSelect",
  "elevateEdgesOnSelect",
  "minZoom",
  "maxZoom",
  "nodeExtent",
  "onNodesChange",
  "onEdgesChange",
  "elementsSelectable",
  "connectionMode",
  "snapGrid",
  "snapToGrid",
  "translateExtent",
  "connectOnClick",
  "defaultEdgeOptions",
  "fitView",
  "fitViewOptions",
  "onNodesDelete",
  "onEdgesDelete",
  "onDelete",
  "onNodeDrag",
  "onNodeDragStart",
  "onNodeDragStop",
  "onSelectionDrag",
  "onSelectionDragStart",
  "onSelectionDragStop",
  "onMoveStart",
  "onMove",
  "onMoveEnd",
  "noPanClassName",
  "nodeOrigin",
  "autoPanOnConnect",
  "autoPanOnNodeDrag",
  "onError",
  "connectionRadius",
  "isValidConnection",
  "selectNodesOnDrag",
  "nodeDragThreshold",
  "connectionDragThreshold",
  "onBeforeDelete",
  "debug",
  "autoPanSpeed",
  "ariaLabelConfig",
  "zIndexMode"
];
var fieldsToTrack = [...reactFlowFieldsToTrack, "rfId"];
var selector$l = (s) => ({
  setNodes: s.setNodes,
  setEdges: s.setEdges,
  setMinZoom: s.setMinZoom,
  setMaxZoom: s.setMaxZoom,
  setTranslateExtent: s.setTranslateExtent,
  setNodeExtent: s.setNodeExtent,
  reset: s.reset,
  setDefaultNodesAndEdges: s.setDefaultNodesAndEdges
});
var initPrevValues2 = {
  /*
   * these are values that are also passed directly to other components
   * than the StoreUpdater. We can reduce the number of setStore calls
   * by setting the same values here as prev fields.
   */
  translateExtent: infiniteExtent,
  nodeOrigin: defaultNodeOrigin,
  minZoom: 0.5,
  maxZoom: 2,
  elementsSelectable: true,
  noPanClassName: "nopan",
  rfId: "1"
};
function StoreUpdater(props) {
  const { setNodes, setEdges, setMinZoom, setMaxZoom, setTranslateExtent, setNodeExtent, reset, setDefaultNodesAndEdges } = useStore(selector$l, shallow$1);
  const store = useStoreApi();
  (0, import_react6.useEffect)(() => {
    setDefaultNodesAndEdges(props.defaultNodes, props.defaultEdges);
    return () => {
      previousFields.current = initPrevValues2;
      reset();
    };
  }, []);
  const previousFields = (0, import_react6.useRef)(initPrevValues2);
  (0, import_react6.useEffect)(
    () => {
      for (const fieldName of fieldsToTrack) {
        const fieldValue = props[fieldName];
        const previousFieldValue = previousFields.current[fieldName];
        if (fieldValue === previousFieldValue)
          continue;
        if (typeof props[fieldName] === "undefined")
          continue;
        if (fieldName === "nodes")
          setNodes(fieldValue);
        else if (fieldName === "edges")
          setEdges(fieldValue);
        else if (fieldName === "minZoom")
          setMinZoom(fieldValue);
        else if (fieldName === "maxZoom")
          setMaxZoom(fieldValue);
        else if (fieldName === "translateExtent")
          setTranslateExtent(fieldValue);
        else if (fieldName === "nodeExtent")
          setNodeExtent(fieldValue);
        else if (fieldName === "ariaLabelConfig")
          store.setState({ ariaLabelConfig: mergeAriaLabelConfig(fieldValue) });
        else if (fieldName === "fitView")
          store.setState({ fitViewQueued: fieldValue });
        else if (fieldName === "fitViewOptions")
          store.setState({ fitViewOptions: fieldValue });
        else
          store.setState({ [fieldName]: fieldValue });
      }
      previousFields.current = props;
    },
    // Only re-run the effect if one of the fields we track changes
    fieldsToTrack.map((fieldName) => props[fieldName])
  );
  return null;
}
function getMediaQuery() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return null;
  }
  return window.matchMedia("(prefers-color-scheme: dark)");
}
function useColorModeClass(colorMode) {
  const [colorModeClass, setColorModeClass] = (0, import_react6.useState)(colorMode === "system" ? null : colorMode);
  (0, import_react6.useEffect)(() => {
    if (colorMode !== "system") {
      setColorModeClass(colorMode);
      return;
    }
    const mediaQuery = getMediaQuery();
    const updateColorModeClass = () => setColorModeClass(mediaQuery?.matches ? "dark" : "light");
    updateColorModeClass();
    mediaQuery?.addEventListener("change", updateColorModeClass);
    return () => {
      mediaQuery?.removeEventListener("change", updateColorModeClass);
    };
  }, [colorMode]);
  return colorModeClass !== null ? colorModeClass : getMediaQuery()?.matches ? "dark" : "light";
}
var defaultDoc = typeof document !== "undefined" ? document : null;
function useKeyPress(keyCode = null, options = { target: defaultDoc, actInsideInputWithModifier: true }) {
  const [keyPressed, setKeyPressed] = (0, import_react6.useState)(false);
  const modifierPressed = (0, import_react6.useRef)(false);
  const pressedKeys = (0, import_react6.useRef)(/* @__PURE__ */ new Set([]));
  const [keyCodes, keysToWatch] = (0, import_react6.useMemo)(() => {
    if (keyCode !== null) {
      const keyCodeArr = Array.isArray(keyCode) ? keyCode : [keyCode];
      const keys = keyCodeArr.filter((kc) => typeof kc === "string").map((kc) => kc.replace("+", "\n").replace("\n\n", "\n+").split("\n"));
      const keysFlat = keys.reduce((res, item) => res.concat(...item), []);
      return [keys, keysFlat];
    }
    return [[], []];
  }, [keyCode]);
  (0, import_react6.useEffect)(() => {
    const target = options?.target ?? defaultDoc;
    const actInsideInputWithModifier = options?.actInsideInputWithModifier ?? true;
    if (keyCode !== null) {
      const downHandler = (event) => {
        modifierPressed.current = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
        const preventAction = (!modifierPressed.current || modifierPressed.current && !actInsideInputWithModifier) && isInputDOMNode(event);
        if (preventAction) {
          return false;
        }
        const keyOrCode = useKeyOrCode(event.code, keysToWatch);
        pressedKeys.current.add(event[keyOrCode]);
        if (isMatchingKey(keyCodes, pressedKeys.current, false)) {
          const target2 = event.composedPath?.()?.[0] || event.target;
          const isInteractiveElement = target2?.nodeName === "BUTTON" || target2?.nodeName === "A";
          if (options.preventDefault !== false && (modifierPressed.current || !isInteractiveElement)) {
            event.preventDefault();
          }
          setKeyPressed(true);
        }
      };
      const upHandler = (event) => {
        const keyOrCode = useKeyOrCode(event.code, keysToWatch);
        if (isMatchingKey(keyCodes, pressedKeys.current, true)) {
          setKeyPressed(false);
          pressedKeys.current.clear();
        } else {
          pressedKeys.current.delete(event[keyOrCode]);
        }
        if (event.key === "Meta") {
          pressedKeys.current.clear();
        }
        modifierPressed.current = false;
      };
      const resetHandler = () => {
        pressedKeys.current.clear();
        setKeyPressed(false);
      };
      target?.addEventListener("keydown", downHandler);
      target?.addEventListener("keyup", upHandler);
      window.addEventListener("blur", resetHandler);
      window.addEventListener("contextmenu", resetHandler);
      return () => {
        target?.removeEventListener("keydown", downHandler);
        target?.removeEventListener("keyup", upHandler);
        window.removeEventListener("blur", resetHandler);
        window.removeEventListener("contextmenu", resetHandler);
      };
    }
  }, [keyCode, setKeyPressed]);
  return keyPressed;
}
function isMatchingKey(keyCodes, pressedKeys, isUp) {
  return keyCodes.filter((keys) => isUp || keys.length === pressedKeys.size).some((keys) => keys.every((k) => pressedKeys.has(k)));
}
function useKeyOrCode(eventCode, keysToWatch) {
  return keysToWatch.includes(eventCode) ? "code" : "key";
}
var useViewportHelper = () => {
  const store = useStoreApi();
  return (0, import_react6.useMemo)(() => {
    return {
      zoomIn: (options) => {
        const { panZoom } = store.getState();
        return panZoom ? panZoom.scaleBy(1.2, { duration: options?.duration }) : Promise.resolve(false);
      },
      zoomOut: (options) => {
        const { panZoom } = store.getState();
        return panZoom ? panZoom.scaleBy(1 / 1.2, { duration: options?.duration }) : Promise.resolve(false);
      },
      zoomTo: (zoomLevel, options) => {
        const { panZoom } = store.getState();
        return panZoom ? panZoom.scaleTo(zoomLevel, { duration: options?.duration }) : Promise.resolve(false);
      },
      getZoom: () => store.getState().transform[2],
      setViewport: async (viewport, options) => {
        const { transform: [tX, tY, tZoom], panZoom } = store.getState();
        if (!panZoom) {
          return Promise.resolve(false);
        }
        await panZoom.setViewport({
          x: viewport.x ?? tX,
          y: viewport.y ?? tY,
          zoom: viewport.zoom ?? tZoom
        }, options);
        return Promise.resolve(true);
      },
      getViewport: () => {
        const [x, y, zoom] = store.getState().transform;
        return { x, y, zoom };
      },
      setCenter: async (x, y, options) => {
        return store.getState().setCenter(x, y, options);
      },
      fitBounds: async (bounds, options) => {
        const { width, height, minZoom, maxZoom, panZoom } = store.getState();
        const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, options?.padding ?? 0.1);
        if (!panZoom) {
          return Promise.resolve(false);
        }
        await panZoom.setViewport(viewport, {
          duration: options?.duration,
          ease: options?.ease,
          interpolate: options?.interpolate
        });
        return Promise.resolve(true);
      },
      screenToFlowPosition: (clientPosition, options = {}) => {
        const { transform: transform2, snapGrid, snapToGrid, domNode } = store.getState();
        if (!domNode) {
          return clientPosition;
        }
        const { x: domX, y: domY } = domNode.getBoundingClientRect();
        const correctedPosition = {
          x: clientPosition.x - domX,
          y: clientPosition.y - domY
        };
        const _snapGrid = options.snapGrid ?? snapGrid;
        const _snapToGrid = options.snapToGrid ?? snapToGrid;
        return pointToRendererPoint(correctedPosition, transform2, _snapToGrid, _snapGrid);
      },
      flowToScreenPosition: (flowPosition) => {
        const { transform: transform2, domNode } = store.getState();
        if (!domNode) {
          return flowPosition;
        }
        const { x: domX, y: domY } = domNode.getBoundingClientRect();
        const rendererPosition = rendererPointToPoint(flowPosition, transform2);
        return {
          x: rendererPosition.x + domX,
          y: rendererPosition.y + domY
        };
      }
    };
  }, []);
};
function applyChanges(changes, elements) {
  const updatedElements = [];
  const changesMap = /* @__PURE__ */ new Map();
  const addItemChanges = [];
  for (const change of changes) {
    if (change.type === "add") {
      addItemChanges.push(change);
      continue;
    } else if (change.type === "remove" || change.type === "replace") {
      changesMap.set(change.id, [change]);
    } else {
      const elementChanges = changesMap.get(change.id);
      if (elementChanges) {
        elementChanges.push(change);
      } else {
        changesMap.set(change.id, [change]);
      }
    }
  }
  for (const element of elements) {
    const changes2 = changesMap.get(element.id);
    if (!changes2) {
      updatedElements.push(element);
      continue;
    }
    if (changes2[0].type === "remove") {
      continue;
    }
    if (changes2[0].type === "replace") {
      updatedElements.push({ ...changes2[0].item });
      continue;
    }
    const updatedElement = { ...element };
    for (const change of changes2) {
      applyChange(change, updatedElement);
    }
    updatedElements.push(updatedElement);
  }
  if (addItemChanges.length) {
    addItemChanges.forEach((change) => {
      if (change.index !== void 0) {
        updatedElements.splice(change.index, 0, { ...change.item });
      } else {
        updatedElements.push({ ...change.item });
      }
    });
  }
  return updatedElements;
}
function applyChange(change, element) {
  switch (change.type) {
    case "select": {
      element.selected = change.selected;
      break;
    }
    case "position": {
      if (typeof change.position !== "undefined") {
        element.position = change.position;
      }
      if (typeof change.dragging !== "undefined") {
        element.dragging = change.dragging;
      }
      break;
    }
    case "dimensions": {
      if (typeof change.dimensions !== "undefined") {
        element.measured = {
          ...change.dimensions
        };
        if (change.setAttributes) {
          if (change.setAttributes === true || change.setAttributes === "width") {
            element.width = change.dimensions.width;
          }
          if (change.setAttributes === true || change.setAttributes === "height") {
            element.height = change.dimensions.height;
          }
        }
      }
      if (typeof change.resizing === "boolean") {
        element.resizing = change.resizing;
      }
      break;
    }
  }
}
function applyNodeChanges(changes, nodes) {
  return applyChanges(changes, nodes);
}
function applyEdgeChanges(changes, edges) {
  return applyChanges(changes, edges);
}
function createSelectionChange(id2, selected2) {
  return {
    id: id2,
    type: "select",
    selected: selected2
  };
}
function getSelectionChanges(items, selectedIds = /* @__PURE__ */ new Set(), mutateItem = false) {
  const changes = [];
  for (const [id2, item] of items) {
    const willBeSelected = selectedIds.has(id2);
    if (!(item.selected === void 0 && !willBeSelected) && item.selected !== willBeSelected) {
      if (mutateItem) {
        item.selected = willBeSelected;
      }
      changes.push(createSelectionChange(item.id, willBeSelected));
    }
  }
  return changes;
}
function getElementsDiffChanges({ items = [], lookup }) {
  const changes = [];
  const itemsLookup = new Map(items.map((item) => [item.id, item]));
  for (const [index2, item] of items.entries()) {
    const lookupItem = lookup.get(item.id);
    const storeItem = lookupItem?.internals?.userNode ?? lookupItem;
    if (storeItem !== void 0 && storeItem !== item) {
      changes.push({ id: item.id, item, type: "replace" });
    }
    if (storeItem === void 0) {
      changes.push({ item, type: "add", index: index2 });
    }
  }
  for (const [id2] of lookup) {
    const nextNode = itemsLookup.get(id2);
    if (nextNode === void 0) {
      changes.push({ id: id2, type: "remove" });
    }
  }
  return changes;
}
function elementToRemoveChange(item) {
  return {
    id: item.id,
    type: "remove"
  };
}
var isNode = (element) => isNodeBase(element);
var isEdge = (element) => isEdgeBase(element);
function fixedForwardRef(render) {
  return (0, import_react6.forwardRef)(render);
}
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? import_react6.useLayoutEffect : import_react6.useEffect;
function useQueue(runQueue) {
  const [serial, setSerial] = (0, import_react6.useState)(BigInt(0));
  const [queue] = (0, import_react6.useState)(() => createQueue(() => setSerial((n) => n + BigInt(1))));
  useIsomorphicLayoutEffect(() => {
    const queueItems = queue.get();
    if (queueItems.length) {
      runQueue(queueItems);
      queue.reset();
    }
  }, [serial]);
  return queue;
}
function createQueue(cb) {
  let queue = [];
  return {
    get: () => queue,
    reset: () => {
      queue = [];
    },
    push: (item) => {
      queue.push(item);
      cb();
    }
  };
}
var BatchContext = (0, import_react6.createContext)(null);
function BatchProvider({ children: children2 }) {
  const store = useStoreApi();
  const nodeQueueHandler = (0, import_react6.useCallback)((queueItems) => {
    const { nodes = [], setNodes, hasDefaultNodes, onNodesChange, nodeLookup, fitViewQueued, onNodesChangeMiddlewareMap } = store.getState();
    let next = nodes;
    for (const payload of queueItems) {
      next = typeof payload === "function" ? payload(next) : payload;
    }
    let changes = getElementsDiffChanges({
      items: next,
      lookup: nodeLookup
    });
    for (const middleware of onNodesChangeMiddlewareMap.values()) {
      changes = middleware(changes);
    }
    if (hasDefaultNodes) {
      setNodes(next);
    }
    if (changes.length > 0) {
      onNodesChange?.(changes);
    } else if (fitViewQueued) {
      window.requestAnimationFrame(() => {
        const { fitViewQueued: fitViewQueued2, nodes: nodes2, setNodes: setNodes2 } = store.getState();
        if (fitViewQueued2) {
          setNodes2(nodes2);
        }
      });
    }
  }, []);
  const nodeQueue = useQueue(nodeQueueHandler);
  const edgeQueueHandler = (0, import_react6.useCallback)((queueItems) => {
    const { edges = [], setEdges, hasDefaultEdges, onEdgesChange, edgeLookup } = store.getState();
    let next = edges;
    for (const payload of queueItems) {
      next = typeof payload === "function" ? payload(next) : payload;
    }
    if (hasDefaultEdges) {
      setEdges(next);
    } else if (onEdgesChange) {
      onEdgesChange(getElementsDiffChanges({
        items: next,
        lookup: edgeLookup
      }));
    }
  }, []);
  const edgeQueue = useQueue(edgeQueueHandler);
  const value = (0, import_react6.useMemo)(() => ({ nodeQueue, edgeQueue }), []);
  return (0, import_jsx_runtime3.jsx)(BatchContext.Provider, { value, children: children2 });
}
function useBatchContext() {
  const batchContext = (0, import_react6.useContext)(BatchContext);
  if (!batchContext) {
    throw new Error("useBatchContext must be used within a BatchProvider");
  }
  return batchContext;
}
var selector$k = (s) => !!s.panZoom;
function useReactFlow() {
  const viewportHelper = useViewportHelper();
  const store = useStoreApi();
  const batchContext = useBatchContext();
  const viewportInitialized = useStore(selector$k);
  const generalHelper = (0, import_react6.useMemo)(() => {
    const getInternalNode = (id2) => store.getState().nodeLookup.get(id2);
    const setNodes = (payload) => {
      batchContext.nodeQueue.push(payload);
    };
    const setEdges = (payload) => {
      batchContext.edgeQueue.push(payload);
    };
    const getNodeRect = (node) => {
      const { nodeLookup, nodeOrigin } = store.getState();
      const nodeToUse = isNode(node) ? node : nodeLookup.get(node.id);
      const position = nodeToUse.parentId ? evaluateAbsolutePosition(nodeToUse.position, nodeToUse.measured, nodeToUse.parentId, nodeLookup, nodeOrigin) : nodeToUse.position;
      const nodeWithPosition = {
        ...nodeToUse,
        position,
        width: nodeToUse.measured?.width ?? nodeToUse.width,
        height: nodeToUse.measured?.height ?? nodeToUse.height
      };
      return nodeToRect(nodeWithPosition);
    };
    const updateNode = (id2, nodeUpdate, options = { replace: false }) => {
      setNodes((prevNodes) => prevNodes.map((node) => {
        if (node.id === id2) {
          const nextNode = typeof nodeUpdate === "function" ? nodeUpdate(node) : nodeUpdate;
          return options.replace && isNode(nextNode) ? nextNode : { ...node, ...nextNode };
        }
        return node;
      }));
    };
    const updateEdge = (id2, edgeUpdate, options = { replace: false }) => {
      setEdges((prevEdges) => prevEdges.map((edge) => {
        if (edge.id === id2) {
          const nextEdge = typeof edgeUpdate === "function" ? edgeUpdate(edge) : edgeUpdate;
          return options.replace && isEdge(nextEdge) ? nextEdge : { ...edge, ...nextEdge };
        }
        return edge;
      }));
    };
    return {
      getNodes: () => store.getState().nodes.map((n) => ({ ...n })),
      getNode: (id2) => getInternalNode(id2)?.internals.userNode,
      getInternalNode,
      getEdges: () => {
        const { edges = [] } = store.getState();
        return edges.map((e) => ({ ...e }));
      },
      getEdge: (id2) => store.getState().edgeLookup.get(id2),
      setNodes,
      setEdges,
      addNodes: (payload) => {
        const newNodes = Array.isArray(payload) ? payload : [payload];
        batchContext.nodeQueue.push((nodes) => [...nodes, ...newNodes]);
      },
      addEdges: (payload) => {
        const newEdges = Array.isArray(payload) ? payload : [payload];
        batchContext.edgeQueue.push((edges) => [...edges, ...newEdges]);
      },
      toObject: () => {
        const { nodes = [], edges = [], transform: transform2 } = store.getState();
        const [x, y, zoom] = transform2;
        return {
          nodes: nodes.map((n) => ({ ...n })),
          edges: edges.map((e) => ({ ...e })),
          viewport: {
            x,
            y,
            zoom
          }
        };
      },
      deleteElements: async ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
        const { nodes, edges, onNodesDelete, onEdgesDelete, triggerNodeChanges, triggerEdgeChanges, onDelete, onBeforeDelete } = store.getState();
        const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove({
          nodesToRemove,
          edgesToRemove,
          nodes,
          edges,
          onBeforeDelete
        });
        const hasMatchingEdges = matchingEdges.length > 0;
        const hasMatchingNodes = matchingNodes.length > 0;
        if (hasMatchingEdges) {
          const edgeChanges = matchingEdges.map(elementToRemoveChange);
          onEdgesDelete?.(matchingEdges);
          triggerEdgeChanges(edgeChanges);
        }
        if (hasMatchingNodes) {
          const nodeChanges = matchingNodes.map(elementToRemoveChange);
          onNodesDelete?.(matchingNodes);
          triggerNodeChanges(nodeChanges);
        }
        if (hasMatchingNodes || hasMatchingEdges) {
          onDelete?.({ nodes: matchingNodes, edges: matchingEdges });
        }
        return { deletedNodes: matchingNodes, deletedEdges: matchingEdges };
      },
      /**
       * Partial is defined as "the 2 nodes/areas are intersecting partially".
       * If a is contained in b or b is contained in a, they are both
       * considered fully intersecting.
       */
      getIntersectingNodes: (nodeOrRect, partially = true, nodes) => {
        const isRect = isRectObject(nodeOrRect);
        const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);
        const hasNodesOption = nodes !== void 0;
        if (!nodeRect) {
          return [];
        }
        return (nodes || store.getState().nodes).filter((n) => {
          const internalNode = store.getState().nodeLookup.get(n.id);
          if (internalNode && !isRect && (n.id === nodeOrRect.id || !internalNode.internals.positionAbsolute)) {
            return false;
          }
          const currNodeRect = nodeToRect(hasNodesOption ? n : internalNode);
          const overlappingArea = getOverlappingArea(currNodeRect, nodeRect);
          const partiallyVisible = partially && overlappingArea > 0;
          return partiallyVisible || overlappingArea >= currNodeRect.width * currNodeRect.height || overlappingArea >= nodeRect.width * nodeRect.height;
        });
      },
      isNodeIntersecting: (nodeOrRect, area, partially = true) => {
        const isRect = isRectObject(nodeOrRect);
        const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);
        if (!nodeRect) {
          return false;
        }
        const overlappingArea = getOverlappingArea(nodeRect, area);
        const partiallyVisible = partially && overlappingArea > 0;
        return partiallyVisible || overlappingArea >= area.width * area.height || overlappingArea >= nodeRect.width * nodeRect.height;
      },
      updateNode,
      updateNodeData: (id2, dataUpdate, options = { replace: false }) => {
        updateNode(id2, (node) => {
          const nextData = typeof dataUpdate === "function" ? dataUpdate(node) : dataUpdate;
          return options.replace ? { ...node, data: nextData } : { ...node, data: { ...node.data, ...nextData } };
        }, options);
      },
      updateEdge,
      updateEdgeData: (id2, dataUpdate, options = { replace: false }) => {
        updateEdge(id2, (edge) => {
          const nextData = typeof dataUpdate === "function" ? dataUpdate(edge) : dataUpdate;
          return options.replace ? { ...edge, data: nextData } : { ...edge, data: { ...edge.data, ...nextData } };
        }, options);
      },
      getNodesBounds: (nodes) => {
        const { nodeLookup, nodeOrigin } = store.getState();
        return getNodesBounds(nodes, { nodeLookup, nodeOrigin });
      },
      getHandleConnections: ({ type, id: id2, nodeId }) => Array.from(store.getState().connectionLookup.get(`${nodeId}-${type}${id2 ? `-${id2}` : ""}`)?.values() ?? []),
      getNodeConnections: ({ type, handleId, nodeId }) => Array.from(store.getState().connectionLookup.get(`${nodeId}${type ? handleId ? `-${type}-${handleId}` : `-${type}` : ""}`)?.values() ?? []),
      fitView: async (options) => {
        const fitViewResolver = store.getState().fitViewResolver ?? withResolvers();
        store.setState({ fitViewQueued: true, fitViewOptions: options, fitViewResolver });
        batchContext.nodeQueue.push((nodes) => [...nodes]);
        return fitViewResolver.promise;
      }
    };
  }, []);
  return (0, import_react6.useMemo)(() => {
    return {
      ...generalHelper,
      ...viewportHelper,
      viewportInitialized
    };
  }, [viewportInitialized]);
}
var selected = (item) => item.selected;
var win$1 = typeof window !== "undefined" ? window : void 0;
function useGlobalKeyHandler({ deleteKeyCode, multiSelectionKeyCode }) {
  const store = useStoreApi();
  const { deleteElements } = useReactFlow();
  const deleteKeyPressed = useKeyPress(deleteKeyCode, { actInsideInputWithModifier: false });
  const multiSelectionKeyPressed = useKeyPress(multiSelectionKeyCode, { target: win$1 });
  (0, import_react6.useEffect)(() => {
    if (deleteKeyPressed) {
      const { edges, nodes } = store.getState();
      deleteElements({ nodes: nodes.filter(selected), edges: edges.filter(selected) });
      store.setState({ nodesSelectionActive: false });
    }
  }, [deleteKeyPressed]);
  (0, import_react6.useEffect)(() => {
    store.setState({ multiSelectionActive: multiSelectionKeyPressed });
  }, [multiSelectionKeyPressed]);
}
function useResizeHandler(domNode) {
  const store = useStoreApi();
  (0, import_react6.useEffect)(() => {
    const updateDimensions = () => {
      if (!domNode.current || !(domNode.current.checkVisibility?.() ?? true)) {
        return false;
      }
      const size = getDimensions(domNode.current);
      if (size.height === 0 || size.width === 0) {
        store.getState().onError?.("004", errorMessages["error004"]());
      }
      store.setState({ width: size.width || 500, height: size.height || 500 });
    };
    if (domNode.current) {
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      const resizeObserver = new ResizeObserver(() => updateDimensions());
      resizeObserver.observe(domNode.current);
      return () => {
        window.removeEventListener("resize", updateDimensions);
        if (resizeObserver && domNode.current) {
          resizeObserver.unobserve(domNode.current);
        }
      };
    }
  }, []);
}
var containerStyle = {
  position: "absolute",
  width: "100%",
  height: "100%",
  top: 0,
  left: 0
};
var selector$j = (s) => ({
  userSelectionActive: s.userSelectionActive,
  lib: s.lib,
  connectionInProgress: s.connection.inProgress
});
function ZoomPane({ onPaneContextMenu, zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panOnScrollSpeed = 0.5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, defaultViewport: defaultViewport2, translateExtent, minZoom, maxZoom, zoomActivationKeyCode, preventScrolling = true, children: children2, noWheelClassName, noPanClassName, onViewportChange, isControlledViewport, paneClickDistance, selectionOnDrag }) {
  const store = useStoreApi();
  const zoomPane = (0, import_react6.useRef)(null);
  const { userSelectionActive, lib, connectionInProgress } = useStore(selector$j, shallow$1);
  const zoomActivationKeyPressed = useKeyPress(zoomActivationKeyCode);
  const panZoom = (0, import_react6.useRef)();
  useResizeHandler(zoomPane);
  const onTransformChange = (0, import_react6.useCallback)((transform2) => {
    onViewportChange?.({ x: transform2[0], y: transform2[1], zoom: transform2[2] });
    if (!isControlledViewport) {
      store.setState({ transform: transform2 });
    }
  }, [onViewportChange, isControlledViewport]);
  (0, import_react6.useEffect)(() => {
    if (zoomPane.current) {
      panZoom.current = XYPanZoom({
        domNode: zoomPane.current,
        minZoom,
        maxZoom,
        translateExtent,
        viewport: defaultViewport2,
        onDraggingChange: (paneDragging) => store.setState((prevState) => prevState.paneDragging === paneDragging ? prevState : { paneDragging }),
        onPanZoomStart: (event, vp) => {
          const { onViewportChangeStart, onMoveStart } = store.getState();
          onMoveStart?.(event, vp);
          onViewportChangeStart?.(vp);
        },
        onPanZoom: (event, vp) => {
          const { onViewportChange: onViewportChange2, onMove } = store.getState();
          onMove?.(event, vp);
          onViewportChange2?.(vp);
        },
        onPanZoomEnd: (event, vp) => {
          const { onViewportChangeEnd, onMoveEnd } = store.getState();
          onMoveEnd?.(event, vp);
          onViewportChangeEnd?.(vp);
        }
      });
      const { x, y, zoom } = panZoom.current.getViewport();
      store.setState({
        panZoom: panZoom.current,
        transform: [x, y, zoom],
        domNode: zoomPane.current.closest(".react-flow")
      });
      return () => {
        panZoom.current?.destroy();
      };
    }
  }, []);
  (0, import_react6.useEffect)(() => {
    panZoom.current?.update({
      onPaneContextMenu,
      zoomOnScroll,
      zoomOnPinch,
      panOnScroll,
      panOnScrollSpeed,
      panOnScrollMode,
      zoomOnDoubleClick,
      panOnDrag,
      zoomActivationKeyPressed,
      preventScrolling,
      noPanClassName,
      userSelectionActive,
      noWheelClassName,
      lib,
      onTransformChange,
      connectionInProgress,
      selectionOnDrag,
      paneClickDistance
    });
  }, [
    onPaneContextMenu,
    zoomOnScroll,
    zoomOnPinch,
    panOnScroll,
    panOnScrollSpeed,
    panOnScrollMode,
    zoomOnDoubleClick,
    panOnDrag,
    zoomActivationKeyPressed,
    preventScrolling,
    noPanClassName,
    userSelectionActive,
    noWheelClassName,
    lib,
    onTransformChange,
    connectionInProgress,
    selectionOnDrag,
    paneClickDistance
  ]);
  return (0, import_jsx_runtime3.jsx)("div", { className: "react-flow__renderer", ref: zoomPane, style: containerStyle, children: children2 });
}
var selector$i = (s) => ({
  userSelectionActive: s.userSelectionActive,
  userSelectionRect: s.userSelectionRect
});
function UserSelection() {
  const { userSelectionActive, userSelectionRect } = useStore(selector$i, shallow$1);
  const isActive = userSelectionActive && userSelectionRect;
  if (!isActive) {
    return null;
  }
  return (0, import_jsx_runtime3.jsx)("div", { className: "react-flow__selection react-flow__container", style: {
    width: userSelectionRect.width,
    height: userSelectionRect.height,
    transform: `translate(${userSelectionRect.x}px, ${userSelectionRect.y}px)`
  } });
}
var wrapHandler = (handler, containerRef) => {
  return (event) => {
    if (event.target !== containerRef.current) {
      return;
    }
    handler?.(event);
  };
};
var selector$h = (s) => ({
  userSelectionActive: s.userSelectionActive,
  elementsSelectable: s.elementsSelectable,
  connectionInProgress: s.connection.inProgress,
  dragging: s.paneDragging
});
function Pane({ isSelecting, selectionKeyPressed, selectionMode = SelectionMode.Full, panOnDrag, paneClickDistance, selectionOnDrag, onSelectionStart, onSelectionEnd, onPaneClick, onPaneContextMenu, onPaneScroll, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, children: children2 }) {
  const store = useStoreApi();
  const { userSelectionActive, elementsSelectable, dragging, connectionInProgress } = useStore(selector$h, shallow$1);
  const isSelectionEnabled = elementsSelectable && (isSelecting || userSelectionActive);
  const container = (0, import_react6.useRef)(null);
  const containerBounds = (0, import_react6.useRef)();
  const selectedNodeIds = (0, import_react6.useRef)(/* @__PURE__ */ new Set());
  const selectedEdgeIds = (0, import_react6.useRef)(/* @__PURE__ */ new Set());
  const selectionInProgress = (0, import_react6.useRef)(false);
  const onClick = (event) => {
    if (selectionInProgress.current || connectionInProgress) {
      selectionInProgress.current = false;
      return;
    }
    onPaneClick?.(event);
    store.getState().resetSelectedElements();
    store.setState({ nodesSelectionActive: false });
  };
  const onContextMenu = (event) => {
    if (Array.isArray(panOnDrag) && panOnDrag?.includes(2)) {
      event.preventDefault();
      return;
    }
    onPaneContextMenu?.(event);
  };
  const onWheel = onPaneScroll ? (event) => onPaneScroll(event) : void 0;
  const onClickCapture = (event) => {
    if (selectionInProgress.current) {
      event.stopPropagation();
      selectionInProgress.current = false;
    }
  };
  const onPointerDownCapture = (event) => {
    const { domNode } = store.getState();
    containerBounds.current = domNode?.getBoundingClientRect();
    if (!containerBounds.current)
      return;
    const eventTargetIsContainer = event.target === container.current;
    const isNoKeyEvent = !eventTargetIsContainer && !!event.target.closest(".nokey");
    const isSelectionActive = selectionOnDrag && eventTargetIsContainer || selectionKeyPressed;
    if (isNoKeyEvent || !isSelecting || !isSelectionActive || event.button !== 0 || !event.isPrimary) {
      return;
    }
    event.target?.setPointerCapture?.(event.pointerId);
    selectionInProgress.current = false;
    const { x, y } = getEventPosition(event.nativeEvent, containerBounds.current);
    store.setState({
      userSelectionRect: {
        width: 0,
        height: 0,
        startX: x,
        startY: y,
        x,
        y
      }
    });
    if (!eventTargetIsContainer) {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  const onPointerMove = (event) => {
    const { userSelectionRect, transform: transform2, nodeLookup, edgeLookup, connectionLookup, triggerNodeChanges, triggerEdgeChanges, defaultEdgeOptions, resetSelectedElements } = store.getState();
    if (!containerBounds.current || !userSelectionRect) {
      return;
    }
    const { x: mouseX, y: mouseY } = getEventPosition(event.nativeEvent, containerBounds.current);
    const { startX, startY } = userSelectionRect;
    if (!selectionInProgress.current) {
      const requiredDistance = selectionKeyPressed ? 0 : paneClickDistance;
      const distance2 = Math.hypot(mouseX - startX, mouseY - startY);
      if (distance2 <= requiredDistance) {
        return;
      }
      resetSelectedElements();
      onSelectionStart?.(event);
    }
    selectionInProgress.current = true;
    const nextUserSelectRect = {
      startX,
      startY,
      x: mouseX < startX ? mouseX : startX,
      y: mouseY < startY ? mouseY : startY,
      width: Math.abs(mouseX - startX),
      height: Math.abs(mouseY - startY)
    };
    const prevSelectedNodeIds = selectedNodeIds.current;
    const prevSelectedEdgeIds = selectedEdgeIds.current;
    selectedNodeIds.current = new Set(getNodesInside(nodeLookup, nextUserSelectRect, transform2, selectionMode === SelectionMode.Partial, true).map((node) => node.id));
    selectedEdgeIds.current = /* @__PURE__ */ new Set();
    const edgesSelectable = defaultEdgeOptions?.selectable ?? true;
    for (const nodeId of selectedNodeIds.current) {
      const connections = connectionLookup.get(nodeId);
      if (!connections)
        continue;
      for (const { edgeId } of connections.values()) {
        const edge = edgeLookup.get(edgeId);
        if (edge && (edge.selectable ?? edgesSelectable)) {
          selectedEdgeIds.current.add(edgeId);
        }
      }
    }
    if (!areSetsEqual(prevSelectedNodeIds, selectedNodeIds.current)) {
      const changes = getSelectionChanges(nodeLookup, selectedNodeIds.current, true);
      triggerNodeChanges(changes);
    }
    if (!areSetsEqual(prevSelectedEdgeIds, selectedEdgeIds.current)) {
      const changes = getSelectionChanges(edgeLookup, selectedEdgeIds.current);
      triggerEdgeChanges(changes);
    }
    store.setState({
      userSelectionRect: nextUserSelectRect,
      userSelectionActive: true,
      nodesSelectionActive: false
    });
  };
  const onPointerUp = (event) => {
    if (event.button !== 0) {
      return;
    }
    event.target?.releasePointerCapture?.(event.pointerId);
    if (!userSelectionActive && event.target === container.current && store.getState().userSelectionRect) {
      onClick?.(event);
    }
    store.setState({
      userSelectionActive: false,
      userSelectionRect: null
    });
    if (selectionInProgress.current) {
      onSelectionEnd?.(event);
      store.setState({
        nodesSelectionActive: selectedNodeIds.current.size > 0
      });
    }
  };
  const draggable = panOnDrag === true || Array.isArray(panOnDrag) && panOnDrag.includes(0);
  return (0, import_jsx_runtime3.jsxs)("div", { className: cc(["react-flow__pane", { draggable, dragging, selection: isSelecting }]), onClick: isSelectionEnabled ? void 0 : wrapHandler(onClick, container), onContextMenu: wrapHandler(onContextMenu, container), onWheel: wrapHandler(onWheel, container), onPointerEnter: isSelectionEnabled ? void 0 : onPaneMouseEnter, onPointerMove: isSelectionEnabled ? onPointerMove : onPaneMouseMove, onPointerUp: isSelectionEnabled ? onPointerUp : void 0, onPointerDownCapture: isSelectionEnabled ? onPointerDownCapture : void 0, onClickCapture: isSelectionEnabled ? onClickCapture : void 0, onPointerLeave: onPaneMouseLeave, ref: container, style: containerStyle, children: [children2, (0, import_jsx_runtime3.jsx)(UserSelection, {})] });
}
function handleNodeClick({ id: id2, store, unselect = false, nodeRef }) {
  const { addSelectedNodes, unselectNodesAndEdges, multiSelectionActive, nodeLookup, onError } = store.getState();
  const node = nodeLookup.get(id2);
  if (!node) {
    onError?.("012", errorMessages["error012"](id2));
    return;
  }
  store.setState({ nodesSelectionActive: false });
  if (!node.selected) {
    addSelectedNodes([id2]);
  } else if (unselect || node.selected && multiSelectionActive) {
    unselectNodesAndEdges({ nodes: [node], edges: [] });
    requestAnimationFrame(() => nodeRef?.current?.blur());
  }
}
function useDrag({ nodeRef, disabled = false, noDragClassName, handleSelector, nodeId, isSelectable, nodeClickDistance }) {
  const store = useStoreApi();
  const [dragging, setDragging] = (0, import_react6.useState)(false);
  const xyDrag = (0, import_react6.useRef)();
  (0, import_react6.useEffect)(() => {
    xyDrag.current = XYDrag({
      getStoreItems: () => store.getState(),
      onNodeMouseDown: (id2) => {
        handleNodeClick({
          id: id2,
          store,
          nodeRef
        });
      },
      onDragStart: () => {
        setDragging(true);
      },
      onDragStop: () => {
        setDragging(false);
      }
    });
  }, []);
  (0, import_react6.useEffect)(() => {
    if (disabled || !nodeRef.current || !xyDrag.current) {
      return;
    }
    xyDrag.current.update({
      noDragClassName,
      handleSelector,
      domNode: nodeRef.current,
      isSelectable,
      nodeId,
      nodeClickDistance
    });
    return () => {
      xyDrag.current?.destroy();
    };
  }, [noDragClassName, handleSelector, disabled, isSelectable, nodeRef, nodeId, nodeClickDistance]);
  return dragging;
}
var selectedAndDraggable = (nodesDraggable) => (n) => n.selected && (n.draggable || nodesDraggable && typeof n.draggable === "undefined");
function useMoveSelectedNodes() {
  const store = useStoreApi();
  const moveSelectedNodes = (0, import_react6.useCallback)((params) => {
    const { nodeExtent, snapToGrid, snapGrid, nodesDraggable, onError, updateNodePositions, nodeLookup, nodeOrigin } = store.getState();
    const nodeUpdates = /* @__PURE__ */ new Map();
    const isSelected = selectedAndDraggable(nodesDraggable);
    const xVelo = snapToGrid ? snapGrid[0] : 5;
    const yVelo = snapToGrid ? snapGrid[1] : 5;
    const xDiff = params.direction.x * xVelo * params.factor;
    const yDiff = params.direction.y * yVelo * params.factor;
    for (const [, node] of nodeLookup) {
      if (!isSelected(node)) {
        continue;
      }
      let nextPosition = {
        x: node.internals.positionAbsolute.x + xDiff,
        y: node.internals.positionAbsolute.y + yDiff
      };
      if (snapToGrid) {
        nextPosition = snapPosition(nextPosition, snapGrid);
      }
      const { position, positionAbsolute } = calculateNodePosition({
        nodeId: node.id,
        nextPosition,
        nodeLookup,
        nodeExtent,
        nodeOrigin,
        onError
      });
      node.position = position;
      node.internals.positionAbsolute = positionAbsolute;
      nodeUpdates.set(node.id, node);
    }
    updateNodePositions(nodeUpdates);
  }, []);
  return moveSelectedNodes;
}
var NodeIdContext = (0, import_react6.createContext)(null);
var Provider = NodeIdContext.Provider;
NodeIdContext.Consumer;
var useNodeId = () => {
  const nodeId = (0, import_react6.useContext)(NodeIdContext);
  return nodeId;
};
var selector$g = (s) => ({
  connectOnClick: s.connectOnClick,
  noPanClassName: s.noPanClassName,
  rfId: s.rfId
});
var connectingSelector = (nodeId, handleId, type) => (state) => {
  const { connectionClickStartHandle: clickHandle, connectionMode, connection } = state;
  const { fromHandle, toHandle, isValid } = connection;
  const connectingTo = toHandle?.nodeId === nodeId && toHandle?.id === handleId && toHandle?.type === type;
  return {
    connectingFrom: fromHandle?.nodeId === nodeId && fromHandle?.id === handleId && fromHandle?.type === type,
    connectingTo,
    clickConnecting: clickHandle?.nodeId === nodeId && clickHandle?.id === handleId && clickHandle?.type === type,
    isPossibleEndHandle: connectionMode === ConnectionMode.Strict ? fromHandle?.type !== type : nodeId !== fromHandle?.nodeId || handleId !== fromHandle?.id,
    connectionInProcess: !!fromHandle,
    clickConnectionInProcess: !!clickHandle,
    valid: connectingTo && isValid
  };
};
function HandleComponent({ type = "source", position = Position.Top, isValidConnection, isConnectable = true, isConnectableStart = true, isConnectableEnd = true, id: id2, onConnect, children: children2, className, onMouseDown, onTouchStart, ...rest }, ref) {
  const handleId = id2 || null;
  const isTarget = type === "target";
  const store = useStoreApi();
  const nodeId = useNodeId();
  const { connectOnClick, noPanClassName, rfId } = useStore(selector$g, shallow$1);
  const { connectingFrom, connectingTo, clickConnecting, isPossibleEndHandle, connectionInProcess, clickConnectionInProcess, valid } = useStore(connectingSelector(nodeId, handleId, type), shallow$1);
  if (!nodeId) {
    store.getState().onError?.("010", errorMessages["error010"]());
  }
  const onConnectExtended = (params) => {
    const { defaultEdgeOptions, onConnect: onConnectAction, hasDefaultEdges } = store.getState();
    const edgeParams = {
      ...defaultEdgeOptions,
      ...params
    };
    if (hasDefaultEdges) {
      const { edges, setEdges } = store.getState();
      setEdges(addEdge(edgeParams, edges));
    }
    onConnectAction?.(edgeParams);
    onConnect?.(edgeParams);
  };
  const onPointerDown2 = (event) => {
    if (!nodeId) {
      return;
    }
    const isMouseTriggered = isMouseEvent(event.nativeEvent);
    if (isConnectableStart && (isMouseTriggered && event.button === 0 || !isMouseTriggered)) {
      const currentStore = store.getState();
      XYHandle.onPointerDown(event.nativeEvent, {
        handleDomNode: event.currentTarget,
        autoPanOnConnect: currentStore.autoPanOnConnect,
        connectionMode: currentStore.connectionMode,
        connectionRadius: currentStore.connectionRadius,
        domNode: currentStore.domNode,
        nodeLookup: currentStore.nodeLookup,
        lib: currentStore.lib,
        isTarget,
        handleId,
        nodeId,
        flowId: currentStore.rfId,
        panBy: currentStore.panBy,
        cancelConnection: currentStore.cancelConnection,
        onConnectStart: currentStore.onConnectStart,
        onConnectEnd: (...args) => store.getState().onConnectEnd?.(...args),
        updateConnection: currentStore.updateConnection,
        onConnect: onConnectExtended,
        isValidConnection: isValidConnection || ((...args) => store.getState().isValidConnection?.(...args) ?? true),
        getTransform: () => store.getState().transform,
        getFromHandle: () => store.getState().connection.fromHandle,
        autoPanSpeed: currentStore.autoPanSpeed,
        dragThreshold: currentStore.connectionDragThreshold
      });
    }
    if (isMouseTriggered) {
      onMouseDown?.(event);
    } else {
      onTouchStart?.(event);
    }
  };
  const onClick = (event) => {
    const { onClickConnectStart, onClickConnectEnd, connectionClickStartHandle, connectionMode, isValidConnection: isValidConnectionStore, lib, rfId: flowId, nodeLookup, connection: connectionState } = store.getState();
    if (!nodeId || !connectionClickStartHandle && !isConnectableStart) {
      return;
    }
    if (!connectionClickStartHandle) {
      onClickConnectStart?.(event.nativeEvent, { nodeId, handleId, handleType: type });
      store.setState({ connectionClickStartHandle: { nodeId, type, id: handleId } });
      return;
    }
    const doc = getHostForElement(event.target);
    const isValidConnectionHandler = isValidConnection || isValidConnectionStore;
    const { connection, isValid } = XYHandle.isValid(event.nativeEvent, {
      handle: {
        nodeId,
        id: handleId,
        type
      },
      connectionMode,
      fromNodeId: connectionClickStartHandle.nodeId,
      fromHandleId: connectionClickStartHandle.id || null,
      fromType: connectionClickStartHandle.type,
      isValidConnection: isValidConnectionHandler,
      flowId,
      doc,
      lib,
      nodeLookup
    });
    if (isValid && connection) {
      onConnectExtended(connection);
    }
    const connectionClone = structuredClone(connectionState);
    delete connectionClone.inProgress;
    connectionClone.toPosition = connectionClone.toHandle ? connectionClone.toHandle.position : null;
    onClickConnectEnd?.(event, connectionClone);
    store.setState({ connectionClickStartHandle: null });
  };
  return (0, import_jsx_runtime3.jsx)("div", { "data-handleid": handleId, "data-nodeid": nodeId, "data-handlepos": position, "data-id": `${rfId}-${nodeId}-${handleId}-${type}`, className: cc([
    "react-flow__handle",
    `react-flow__handle-${position}`,
    "nodrag",
    noPanClassName,
    className,
    {
      source: !isTarget,
      target: isTarget,
      connectable: isConnectable,
      connectablestart: isConnectableStart,
      connectableend: isConnectableEnd,
      clickconnecting: clickConnecting,
      connectingfrom: connectingFrom,
      connectingto: connectingTo,
      valid,
      /*
       * shows where you can start a connection from
       * and where you can end it while connecting
       */
      connectionindicator: isConnectable && (!connectionInProcess || isPossibleEndHandle) && (connectionInProcess || clickConnectionInProcess ? isConnectableEnd : isConnectableStart)
    }
  ]), onMouseDown: onPointerDown2, onTouchStart: onPointerDown2, onClick: connectOnClick ? onClick : void 0, ref, ...rest, children: children2 });
}
var Handle = (0, import_react6.memo)(fixedForwardRef(HandleComponent));
function InputNode({ data, isConnectable, sourcePosition = Position.Bottom }) {
  return (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [data?.label, (0, import_jsx_runtime3.jsx)(Handle, { type: "source", position: sourcePosition, isConnectable })] });
}
function DefaultNode({ data, isConnectable, targetPosition = Position.Top, sourcePosition = Position.Bottom }) {
  return (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [(0, import_jsx_runtime3.jsx)(Handle, { type: "target", position: targetPosition, isConnectable }), data?.label, (0, import_jsx_runtime3.jsx)(Handle, { type: "source", position: sourcePosition, isConnectable })] });
}
function GroupNode() {
  return null;
}
function OutputNode({ data, isConnectable, targetPosition = Position.Top }) {
  return (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [(0, import_jsx_runtime3.jsx)(Handle, { type: "target", position: targetPosition, isConnectable }), data?.label] });
}
var arrowKeyDiffs = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }
};
var builtinNodeTypes = {
  input: InputNode,
  default: DefaultNode,
  output: OutputNode,
  group: GroupNode
};
function getNodeInlineStyleDimensions(node) {
  if (node.internals.handleBounds === void 0) {
    return {
      width: node.width ?? node.initialWidth ?? node.style?.width,
      height: node.height ?? node.initialHeight ?? node.style?.height
    };
  }
  return {
    width: node.width ?? node.style?.width,
    height: node.height ?? node.style?.height
  };
}
var selector$f = (s) => {
  const { width, height, x, y } = getInternalNodesBounds(s.nodeLookup, {
    filter: (node) => !!node.selected
  });
  return {
    width: isNumeric(width) ? width : null,
    height: isNumeric(height) ? height : null,
    userSelectionActive: s.userSelectionActive,
    transformString: `translate(${s.transform[0]}px,${s.transform[1]}px) scale(${s.transform[2]}) translate(${x}px,${y}px)`
  };
};
function NodesSelection({ onSelectionContextMenu, noPanClassName, disableKeyboardA11y }) {
  const store = useStoreApi();
  const { width, height, transformString, userSelectionActive } = useStore(selector$f, shallow$1);
  const moveSelectedNodes = useMoveSelectedNodes();
  const nodeRef = (0, import_react6.useRef)(null);
  (0, import_react6.useEffect)(() => {
    if (!disableKeyboardA11y) {
      nodeRef.current?.focus({
        preventScroll: true
      });
    }
  }, [disableKeyboardA11y]);
  const shouldRender = !userSelectionActive && width !== null && height !== null;
  useDrag({
    nodeRef,
    disabled: !shouldRender
  });
  if (!shouldRender) {
    return null;
  }
  const onContextMenu = onSelectionContextMenu ? (event) => {
    const selectedNodes = store.getState().nodes.filter((n) => n.selected);
    onSelectionContextMenu(event, selectedNodes);
  } : void 0;
  const onKeyDown = (event) => {
    if (Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
      event.preventDefault();
      moveSelectedNodes({
        direction: arrowKeyDiffs[event.key],
        factor: event.shiftKey ? 4 : 1
      });
    }
  };
  return (0, import_jsx_runtime3.jsx)("div", { className: cc(["react-flow__nodesselection", "react-flow__container", noPanClassName]), style: {
    transform: transformString
  }, children: (0, import_jsx_runtime3.jsx)("div", { ref: nodeRef, className: "react-flow__nodesselection-rect", onContextMenu, tabIndex: disableKeyboardA11y ? void 0 : -1, onKeyDown: disableKeyboardA11y ? void 0 : onKeyDown, style: {
    width,
    height
  } }) });
}
var win = typeof window !== "undefined" ? window : void 0;
var selector$e = (s) => {
  return { nodesSelectionActive: s.nodesSelectionActive, userSelectionActive: s.userSelectionActive };
};
function FlowRendererComponent({ children: children2, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneContextMenu, onPaneScroll, paneClickDistance, deleteKeyCode, selectionKeyCode, selectionOnDrag, selectionMode, onSelectionStart, onSelectionEnd, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, elementsSelectable, zoomOnScroll, zoomOnPinch, panOnScroll: _panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag: _panOnDrag, defaultViewport: defaultViewport2, translateExtent, minZoom, maxZoom, preventScrolling, onSelectionContextMenu, noWheelClassName, noPanClassName, disableKeyboardA11y, onViewportChange, isControlledViewport }) {
  const { nodesSelectionActive, userSelectionActive } = useStore(selector$e, shallow$1);
  const selectionKeyPressed = useKeyPress(selectionKeyCode, { target: win });
  const panActivationKeyPressed = useKeyPress(panActivationKeyCode, { target: win });
  const panOnDrag = panActivationKeyPressed || _panOnDrag;
  const panOnScroll = panActivationKeyPressed || _panOnScroll;
  const _selectionOnDrag = selectionOnDrag && panOnDrag !== true;
  const isSelecting = selectionKeyPressed || userSelectionActive || _selectionOnDrag;
  useGlobalKeyHandler({ deleteKeyCode, multiSelectionKeyCode });
  return (0, import_jsx_runtime3.jsx)(ZoomPane, { onPaneContextMenu, elementsSelectable, zoomOnScroll, zoomOnPinch, panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag: !selectionKeyPressed && panOnDrag, defaultViewport: defaultViewport2, translateExtent, minZoom, maxZoom, zoomActivationKeyCode, preventScrolling, noWheelClassName, noPanClassName, onViewportChange, isControlledViewport, paneClickDistance, selectionOnDrag: _selectionOnDrag, children: (0, import_jsx_runtime3.jsxs)(Pane, { onSelectionStart, onSelectionEnd, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneContextMenu, onPaneScroll, panOnDrag, isSelecting: !!isSelecting, selectionMode, selectionKeyPressed, paneClickDistance, selectionOnDrag: _selectionOnDrag, children: [children2, nodesSelectionActive && (0, import_jsx_runtime3.jsx)(NodesSelection, { onSelectionContextMenu, noPanClassName, disableKeyboardA11y })] }) });
}
FlowRendererComponent.displayName = "FlowRenderer";
var FlowRenderer = (0, import_react6.memo)(FlowRendererComponent);
var selector$d = (onlyRenderVisible) => (s) => {
  return onlyRenderVisible ? getNodesInside(s.nodeLookup, { x: 0, y: 0, width: s.width, height: s.height }, s.transform, true).map((node) => node.id) : Array.from(s.nodeLookup.keys());
};
function useVisibleNodeIds(onlyRenderVisible) {
  const nodeIds = useStore((0, import_react6.useCallback)(selector$d(onlyRenderVisible), [onlyRenderVisible]), shallow$1);
  return nodeIds;
}
var selector$c = (s) => s.updateNodeInternals;
function useResizeObserver() {
  const updateNodeInternals2 = useStore(selector$c);
  const [resizeObserver] = (0, import_react6.useState)(() => {
    if (typeof ResizeObserver === "undefined") {
      return null;
    }
    return new ResizeObserver((entries) => {
      const updates = /* @__PURE__ */ new Map();
      entries.forEach((entry) => {
        const id2 = entry.target.getAttribute("data-id");
        updates.set(id2, {
          id: id2,
          nodeElement: entry.target,
          force: true
        });
      });
      updateNodeInternals2(updates);
    });
  });
  (0, import_react6.useEffect)(() => {
    return () => {
      resizeObserver?.disconnect();
    };
  }, [resizeObserver]);
  return resizeObserver;
}
function useNodeObserver({ node, nodeType, hasDimensions, resizeObserver }) {
  const store = useStoreApi();
  const nodeRef = (0, import_react6.useRef)(null);
  const observedNode = (0, import_react6.useRef)(null);
  const prevSourcePosition = (0, import_react6.useRef)(node.sourcePosition);
  const prevTargetPosition = (0, import_react6.useRef)(node.targetPosition);
  const prevType = (0, import_react6.useRef)(nodeType);
  const isInitialized = hasDimensions && !!node.internals.handleBounds;
  (0, import_react6.useEffect)(() => {
    if (nodeRef.current && !node.hidden && (!isInitialized || observedNode.current !== nodeRef.current)) {
      if (observedNode.current) {
        resizeObserver?.unobserve(observedNode.current);
      }
      resizeObserver?.observe(nodeRef.current);
      observedNode.current = nodeRef.current;
    }
  }, [isInitialized, node.hidden]);
  (0, import_react6.useEffect)(() => {
    return () => {
      if (observedNode.current) {
        resizeObserver?.unobserve(observedNode.current);
        observedNode.current = null;
      }
    };
  }, []);
  (0, import_react6.useEffect)(() => {
    if (nodeRef.current) {
      const typeChanged = prevType.current !== nodeType;
      const sourcePosChanged = prevSourcePosition.current !== node.sourcePosition;
      const targetPosChanged = prevTargetPosition.current !== node.targetPosition;
      if (typeChanged || sourcePosChanged || targetPosChanged) {
        prevType.current = nodeType;
        prevSourcePosition.current = node.sourcePosition;
        prevTargetPosition.current = node.targetPosition;
        store.getState().updateNodeInternals(/* @__PURE__ */ new Map([[node.id, { id: node.id, nodeElement: nodeRef.current, force: true }]]));
      }
    }
  }, [node.id, nodeType, node.sourcePosition, node.targetPosition]);
  return nodeRef;
}
function NodeWrapper({ id: id2, onClick, onMouseEnter, onMouseMove, onMouseLeave, onContextMenu, onDoubleClick, nodesDraggable, elementsSelectable, nodesConnectable, nodesFocusable, resizeObserver, noDragClassName, noPanClassName, disableKeyboardA11y, rfId, nodeTypes, nodeClickDistance, onError }) {
  const { node, internals, isParent } = useStore((s) => {
    const node2 = s.nodeLookup.get(id2);
    const isParent2 = s.parentLookup.has(id2);
    return {
      node: node2,
      internals: node2.internals,
      isParent: isParent2
    };
  }, shallow$1);
  let nodeType = node.type || "default";
  let NodeComponent = nodeTypes?.[nodeType] || builtinNodeTypes[nodeType];
  if (NodeComponent === void 0) {
    onError?.("003", errorMessages["error003"](nodeType));
    nodeType = "default";
    NodeComponent = nodeTypes?.["default"] || builtinNodeTypes.default;
  }
  const isDraggable = !!(node.draggable || nodesDraggable && typeof node.draggable === "undefined");
  const isSelectable = !!(node.selectable || elementsSelectable && typeof node.selectable === "undefined");
  const isConnectable = !!(node.connectable || nodesConnectable && typeof node.connectable === "undefined");
  const isFocusable = !!(node.focusable || nodesFocusable && typeof node.focusable === "undefined");
  const store = useStoreApi();
  const hasDimensions = nodeHasDimensions(node);
  const nodeRef = useNodeObserver({ node, nodeType, hasDimensions, resizeObserver });
  const dragging = useDrag({
    nodeRef,
    disabled: node.hidden || !isDraggable,
    noDragClassName,
    handleSelector: node.dragHandle,
    nodeId: id2,
    isSelectable,
    nodeClickDistance
  });
  const moveSelectedNodes = useMoveSelectedNodes();
  if (node.hidden) {
    return null;
  }
  const nodeDimensions = getNodeDimensions(node);
  const inlineDimensions = getNodeInlineStyleDimensions(node);
  const hasPointerEvents = isSelectable || isDraggable || onClick || onMouseEnter || onMouseMove || onMouseLeave;
  const onMouseEnterHandler = onMouseEnter ? (event) => onMouseEnter(event, { ...internals.userNode }) : void 0;
  const onMouseMoveHandler = onMouseMove ? (event) => onMouseMove(event, { ...internals.userNode }) : void 0;
  const onMouseLeaveHandler = onMouseLeave ? (event) => onMouseLeave(event, { ...internals.userNode }) : void 0;
  const onContextMenuHandler = onContextMenu ? (event) => onContextMenu(event, { ...internals.userNode }) : void 0;
  const onDoubleClickHandler = onDoubleClick ? (event) => onDoubleClick(event, { ...internals.userNode }) : void 0;
  const onSelectNodeHandler = (event) => {
    const { selectNodesOnDrag, nodeDragThreshold } = store.getState();
    if (isSelectable && (!selectNodesOnDrag || !isDraggable || nodeDragThreshold > 0)) {
      handleNodeClick({
        id: id2,
        store,
        nodeRef
      });
    }
    if (onClick) {
      onClick(event, { ...internals.userNode });
    }
  };
  const onKeyDown = (event) => {
    if (isInputDOMNode(event.nativeEvent) || disableKeyboardA11y) {
      return;
    }
    if (elementSelectionKeys.includes(event.key) && isSelectable) {
      const unselect = event.key === "Escape";
      handleNodeClick({
        id: id2,
        store,
        unselect,
        nodeRef
      });
    } else if (isDraggable && node.selected && Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
      event.preventDefault();
      const { ariaLabelConfig } = store.getState();
      store.setState({
        ariaLiveMessage: ariaLabelConfig["node.a11yDescription.ariaLiveMessage"]({
          direction: event.key.replace("Arrow", "").toLowerCase(),
          x: ~~internals.positionAbsolute.x,
          y: ~~internals.positionAbsolute.y
        })
      });
      moveSelectedNodes({
        direction: arrowKeyDiffs[event.key],
        factor: event.shiftKey ? 4 : 1
      });
    }
  };
  const onFocus = () => {
    if (disableKeyboardA11y || !nodeRef.current?.matches(":focus-visible")) {
      return;
    }
    const { transform: transform2, width, height, autoPanOnNodeFocus, setCenter } = store.getState();
    if (!autoPanOnNodeFocus) {
      return;
    }
    const withinViewport = getNodesInside(/* @__PURE__ */ new Map([[id2, node]]), { x: 0, y: 0, width, height }, transform2, true).length > 0;
    if (!withinViewport) {
      setCenter(node.position.x + nodeDimensions.width / 2, node.position.y + nodeDimensions.height / 2, {
        zoom: transform2[2]
      });
    }
  };
  return (0, import_jsx_runtime3.jsx)("div", { className: cc([
    "react-flow__node",
    `react-flow__node-${nodeType}`,
    {
      // this is overwritable by passing `nopan` as a class name
      [noPanClassName]: isDraggable
    },
    node.className,
    {
      selected: node.selected,
      selectable: isSelectable,
      parent: isParent,
      draggable: isDraggable,
      dragging
    }
  ]), ref: nodeRef, style: {
    zIndex: internals.z,
    transform: `translate(${internals.positionAbsolute.x}px,${internals.positionAbsolute.y}px)`,
    pointerEvents: hasPointerEvents ? "all" : "none",
    visibility: hasDimensions ? "visible" : "hidden",
    ...node.style,
    ...inlineDimensions
  }, "data-id": id2, "data-testid": `rf__node-${id2}`, onMouseEnter: onMouseEnterHandler, onMouseMove: onMouseMoveHandler, onMouseLeave: onMouseLeaveHandler, onContextMenu: onContextMenuHandler, onClick: onSelectNodeHandler, onDoubleClick: onDoubleClickHandler, onKeyDown: isFocusable ? onKeyDown : void 0, tabIndex: isFocusable ? 0 : void 0, onFocus: isFocusable ? onFocus : void 0, role: node.ariaRole ?? (isFocusable ? "group" : void 0), "aria-roledescription": "node", "aria-describedby": disableKeyboardA11y ? void 0 : `${ARIA_NODE_DESC_KEY}-${rfId}`, "aria-label": node.ariaLabel, ...node.domAttributes, children: (0, import_jsx_runtime3.jsx)(Provider, { value: id2, children: (0, import_jsx_runtime3.jsx)(NodeComponent, { id: id2, data: node.data, type: nodeType, positionAbsoluteX: internals.positionAbsolute.x, positionAbsoluteY: internals.positionAbsolute.y, selected: node.selected ?? false, selectable: isSelectable, draggable: isDraggable, deletable: node.deletable ?? true, isConnectable, sourcePosition: node.sourcePosition, targetPosition: node.targetPosition, dragging, dragHandle: node.dragHandle, zIndex: internals.z, parentId: node.parentId, ...nodeDimensions }) }) });
}
var NodeWrapper$1 = (0, import_react6.memo)(NodeWrapper);
var selector$b = (s) => ({
  nodesDraggable: s.nodesDraggable,
  nodesConnectable: s.nodesConnectable,
  nodesFocusable: s.nodesFocusable,
  elementsSelectable: s.elementsSelectable,
  onError: s.onError
});
function NodeRendererComponent(props) {
  const { nodesDraggable, nodesConnectable, nodesFocusable, elementsSelectable, onError } = useStore(selector$b, shallow$1);
  const nodeIds = useVisibleNodeIds(props.onlyRenderVisibleElements);
  const resizeObserver = useResizeObserver();
  return (0, import_jsx_runtime3.jsx)("div", { className: "react-flow__nodes", style: containerStyle, children: nodeIds.map((nodeId) => {
    return (
      /*
       * The split of responsibilities between NodeRenderer and
       * NodeComponentWrapper may appear weird. However, it’s designed to
       * minimize the cost of updates when individual nodes change.
       *
       * For example, when you’re dragging a single node, that node gets
       * updated multiple times per second. If `NodeRenderer` were to update
       * every time, it would have to re-run the `nodes.map()` loop every
       * time. This gets pricey with hundreds of nodes, especially if every
       * loop cycle does more than just rendering a JSX element!
       *
       * As a result of this choice, we took the following implementation
       * decisions:
       * - NodeRenderer subscribes *only* to node IDs – and therefore
       *   rerender *only* when visible nodes are added or removed.
       * - NodeRenderer performs all operations the result of which can be
       *   shared between nodes (such as creating the `ResizeObserver`
       *   instance, or subscribing to `selector`). This means extra prop
       *   drilling into `NodeComponentWrapper`, but it means we need to run
       *   these operations only once – instead of once per node.
       * - Any operations that you’d normally write inside `nodes.map` are
       *   moved into `NodeComponentWrapper`. This ensures they are
       *   memorized – so if `NodeRenderer` *has* to rerender, it only
       *   needs to regenerate the list of nodes, nothing else.
       */
      (0, import_jsx_runtime3.jsx)(NodeWrapper$1, { id: nodeId, nodeTypes: props.nodeTypes, nodeExtent: props.nodeExtent, onClick: props.onNodeClick, onMouseEnter: props.onNodeMouseEnter, onMouseMove: props.onNodeMouseMove, onMouseLeave: props.onNodeMouseLeave, onContextMenu: props.onNodeContextMenu, onDoubleClick: props.onNodeDoubleClick, noDragClassName: props.noDragClassName, noPanClassName: props.noPanClassName, rfId: props.rfId, disableKeyboardA11y: props.disableKeyboardA11y, resizeObserver, nodesDraggable, nodesConnectable, nodesFocusable, elementsSelectable, nodeClickDistance: props.nodeClickDistance, onError }, nodeId)
    );
  }) });
}
NodeRendererComponent.displayName = "NodeRenderer";
var NodeRenderer = (0, import_react6.memo)(NodeRendererComponent);
function useVisibleEdgeIds(onlyRenderVisible) {
  const edgeIds = useStore((0, import_react6.useCallback)((s) => {
    if (!onlyRenderVisible) {
      return s.edges.map((edge) => edge.id);
    }
    const visibleEdgeIds = [];
    if (s.width && s.height) {
      for (const edge of s.edges) {
        const sourceNode = s.nodeLookup.get(edge.source);
        const targetNode = s.nodeLookup.get(edge.target);
        if (sourceNode && targetNode && isEdgeVisible({
          sourceNode,
          targetNode,
          width: s.width,
          height: s.height,
          transform: s.transform
        })) {
          visibleEdgeIds.push(edge.id);
        }
      }
    }
    return visibleEdgeIds;
  }, [onlyRenderVisible]), shallow$1);
  return edgeIds;
}
var ArrowSymbol = ({ color: color2 = "none", strokeWidth = 1 }) => {
  const style2 = {
    strokeWidth,
    ...color2 && { stroke: color2 }
  };
  return (0, import_jsx_runtime3.jsx)("polyline", { className: "arrow", style: style2, strokeLinecap: "round", fill: "none", strokeLinejoin: "round", points: "-5,-4 0,0 -5,4" });
};
var ArrowClosedSymbol = ({ color: color2 = "none", strokeWidth = 1 }) => {
  const style2 = {
    strokeWidth,
    ...color2 && { stroke: color2, fill: color2 }
  };
  return (0, import_jsx_runtime3.jsx)("polyline", { className: "arrowclosed", style: style2, strokeLinecap: "round", strokeLinejoin: "round", points: "-5,-4 0,0 -5,4 -5,-4" });
};
var MarkerSymbols = {
  [MarkerType.Arrow]: ArrowSymbol,
  [MarkerType.ArrowClosed]: ArrowClosedSymbol
};
function useMarkerSymbol(type) {
  const store = useStoreApi();
  const symbol = (0, import_react6.useMemo)(() => {
    const symbolExists = Object.prototype.hasOwnProperty.call(MarkerSymbols, type);
    if (!symbolExists) {
      store.getState().onError?.("009", errorMessages["error009"](type));
      return null;
    }
    return MarkerSymbols[type];
  }, [type]);
  return symbol;
}
var Marker = ({ id: id2, type, color: color2, width = 12.5, height = 12.5, markerUnits = "strokeWidth", strokeWidth, orient = "auto-start-reverse" }) => {
  const Symbol2 = useMarkerSymbol(type);
  if (!Symbol2) {
    return null;
  }
  return (0, import_jsx_runtime3.jsx)("marker", { className: "react-flow__arrowhead", id: id2, markerWidth: `${width}`, markerHeight: `${height}`, viewBox: "-10 -10 20 20", markerUnits, orient, refX: "0", refY: "0", children: (0, import_jsx_runtime3.jsx)(Symbol2, { color: color2, strokeWidth }) });
};
var MarkerDefinitions = ({ defaultColor, rfId }) => {
  const edges = useStore((s) => s.edges);
  const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
  const markers = (0, import_react6.useMemo)(() => {
    const markers2 = createMarkerIds(edges, {
      id: rfId,
      defaultColor,
      defaultMarkerStart: defaultEdgeOptions?.markerStart,
      defaultMarkerEnd: defaultEdgeOptions?.markerEnd
    });
    return markers2;
  }, [edges, defaultEdgeOptions, rfId, defaultColor]);
  if (!markers.length) {
    return null;
  }
  return (0, import_jsx_runtime3.jsx)("svg", { className: "react-flow__marker", "aria-hidden": "true", children: (0, import_jsx_runtime3.jsx)("defs", { children: markers.map((marker) => (0, import_jsx_runtime3.jsx)(Marker, { id: marker.id, type: marker.type, color: marker.color, width: marker.width, height: marker.height, markerUnits: marker.markerUnits, strokeWidth: marker.strokeWidth, orient: marker.orient }, marker.id)) }) });
};
MarkerDefinitions.displayName = "MarkerDefinitions";
var MarkerDefinitions$1 = (0, import_react6.memo)(MarkerDefinitions);
function EdgeTextComponent({ x, y, label, labelStyle, labelShowBg = true, labelBgStyle, labelBgPadding = [2, 4], labelBgBorderRadius = 2, children: children2, className, ...rest }) {
  const [edgeTextBbox, setEdgeTextBbox] = (0, import_react6.useState)({ x: 1, y: 0, width: 0, height: 0 });
  const edgeTextClasses = cc(["react-flow__edge-textwrapper", className]);
  const edgeTextRef = (0, import_react6.useRef)(null);
  (0, import_react6.useEffect)(() => {
    if (edgeTextRef.current) {
      const textBbox = edgeTextRef.current.getBBox();
      setEdgeTextBbox({
        x: textBbox.x,
        y: textBbox.y,
        width: textBbox.width,
        height: textBbox.height
      });
    }
  }, [label]);
  if (!label) {
    return null;
  }
  return (0, import_jsx_runtime3.jsxs)("g", { transform: `translate(${x - edgeTextBbox.width / 2} ${y - edgeTextBbox.height / 2})`, className: edgeTextClasses, visibility: edgeTextBbox.width ? "visible" : "hidden", ...rest, children: [labelShowBg && (0, import_jsx_runtime3.jsx)("rect", { width: edgeTextBbox.width + 2 * labelBgPadding[0], x: -labelBgPadding[0], y: -labelBgPadding[1], height: edgeTextBbox.height + 2 * labelBgPadding[1], className: "react-flow__edge-textbg", style: labelBgStyle, rx: labelBgBorderRadius, ry: labelBgBorderRadius }), (0, import_jsx_runtime3.jsx)("text", { className: "react-flow__edge-text", y: edgeTextBbox.height / 2, dy: "0.3em", ref: edgeTextRef, style: labelStyle, children: label }), children2] });
}
EdgeTextComponent.displayName = "EdgeText";
var EdgeText = (0, import_react6.memo)(EdgeTextComponent);
function BaseEdge({ path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth = 20, ...props }) {
  return (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [(0, import_jsx_runtime3.jsx)("path", { ...props, d: path, fill: "none", className: cc(["react-flow__edge-path", props.className]) }), interactionWidth ? (0, import_jsx_runtime3.jsx)("path", { d: path, fill: "none", strokeOpacity: 0, strokeWidth: interactionWidth, className: "react-flow__edge-interaction" }) : null, label && isNumeric(labelX) && isNumeric(labelY) ? (0, import_jsx_runtime3.jsx)(EdgeText, { x: labelX, y: labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius }) : null] });
}
function getControl({ pos, x1, y1, x2, y2 }) {
  if (pos === Position.Left || pos === Position.Right) {
    return [0.5 * (x1 + x2), y1];
  }
  return [x1, 0.5 * (y1 + y2)];
}
function getSimpleBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top }) {
  const [sourceControlX, sourceControlY] = getControl({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY
  });
  const [targetControlX, targetControlY] = getControl({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY
  });
  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY
  });
  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY
  ];
}
function createSimpleBezierEdge(params) {
  return (0, import_react6.memo)(({ id: id2, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, markerEnd, markerStart, interactionWidth }) => {
    const [path, labelX, labelY] = getSimpleBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition
    });
    const _id = params.isInternal ? void 0 : id2;
    return (0, import_jsx_runtime3.jsx)(BaseEdge, { id: _id, path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, markerEnd, markerStart, interactionWidth });
  });
}
var SimpleBezierEdge = createSimpleBezierEdge({ isInternal: false });
var SimpleBezierEdgeInternal = createSimpleBezierEdge({ isInternal: true });
SimpleBezierEdge.displayName = "SimpleBezierEdge";
SimpleBezierEdgeInternal.displayName = "SimpleBezierEdgeInternal";
function createSmoothStepEdge(params) {
  return (0, import_react6.memo)(({ id: id2, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, sourcePosition = Position.Bottom, targetPosition = Position.Top, markerEnd, markerStart, pathOptions, interactionWidth }) => {
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: pathOptions?.borderRadius,
      offset: pathOptions?.offset,
      stepPosition: pathOptions?.stepPosition
    });
    const _id = params.isInternal ? void 0 : id2;
    return (0, import_jsx_runtime3.jsx)(BaseEdge, { id: _id, path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, markerEnd, markerStart, interactionWidth });
  });
}
var SmoothStepEdge = createSmoothStepEdge({ isInternal: false });
var SmoothStepEdgeInternal = createSmoothStepEdge({ isInternal: true });
SmoothStepEdge.displayName = "SmoothStepEdge";
SmoothStepEdgeInternal.displayName = "SmoothStepEdgeInternal";
function createStepEdge(params) {
  return (0, import_react6.memo)(({ id: id2, ...props }) => {
    const _id = params.isInternal ? void 0 : id2;
    return (0, import_jsx_runtime3.jsx)(SmoothStepEdge, { ...props, id: _id, pathOptions: (0, import_react6.useMemo)(() => ({ borderRadius: 0, offset: props.pathOptions?.offset }), [props.pathOptions?.offset]) });
  });
}
var StepEdge = createStepEdge({ isInternal: false });
var StepEdgeInternal = createStepEdge({ isInternal: true });
StepEdge.displayName = "StepEdge";
StepEdgeInternal.displayName = "StepEdgeInternal";
function createStraightEdge(params) {
  return (0, import_react6.memo)(({ id: id2, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, markerEnd, markerStart, interactionWidth }) => {
    const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    const _id = params.isInternal ? void 0 : id2;
    return (0, import_jsx_runtime3.jsx)(BaseEdge, { id: _id, path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, markerEnd, markerStart, interactionWidth });
  });
}
var StraightEdge = createStraightEdge({ isInternal: false });
var StraightEdgeInternal = createStraightEdge({ isInternal: true });
StraightEdge.displayName = "StraightEdge";
StraightEdgeInternal.displayName = "StraightEdgeInternal";
function createBezierEdge(params) {
  return (0, import_react6.memo)(({ id: id2, sourceX, sourceY, targetX, targetY, sourcePosition = Position.Bottom, targetPosition = Position.Top, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, markerEnd, markerStart, pathOptions, interactionWidth }) => {
    const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: pathOptions?.curvature
    });
    const _id = params.isInternal ? void 0 : id2;
    return (0, import_jsx_runtime3.jsx)(BaseEdge, { id: _id, path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style: style2, markerEnd, markerStart, interactionWidth });
  });
}
var BezierEdge = createBezierEdge({ isInternal: false });
var BezierEdgeInternal = createBezierEdge({ isInternal: true });
BezierEdge.displayName = "BezierEdge";
BezierEdgeInternal.displayName = "BezierEdgeInternal";
var builtinEdgeTypes = {
  default: BezierEdgeInternal,
  straight: StraightEdgeInternal,
  step: StepEdgeInternal,
  smoothstep: SmoothStepEdgeInternal,
  simplebezier: SimpleBezierEdgeInternal
};
var nullPosition = {
  sourceX: null,
  sourceY: null,
  targetX: null,
  targetY: null,
  sourcePosition: null,
  targetPosition: null
};
var shiftX = (x, shift, position) => {
  if (position === Position.Left)
    return x - shift;
  if (position === Position.Right)
    return x + shift;
  return x;
};
var shiftY = (y, shift, position) => {
  if (position === Position.Top)
    return y - shift;
  if (position === Position.Bottom)
    return y + shift;
  return y;
};
var EdgeUpdaterClassName = "react-flow__edgeupdater";
function EdgeAnchor({ position, centerX, centerY, radius = 10, onMouseDown, onMouseEnter, onMouseOut, type }) {
  return (0, import_jsx_runtime3.jsx)("circle", { onMouseDown, onMouseEnter, onMouseOut, className: cc([EdgeUpdaterClassName, `${EdgeUpdaterClassName}-${type}`]), cx: shiftX(centerX, radius, position), cy: shiftY(centerY, radius, position), r: radius, stroke: "transparent", fill: "transparent" });
}
function EdgeUpdateAnchors({ isReconnectable, reconnectRadius, edge, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, onReconnect, onReconnectStart, onReconnectEnd, setReconnecting, setUpdateHover }) {
  const store = useStoreApi();
  const handleEdgeUpdater = (event, oppositeHandle) => {
    if (event.button !== 0) {
      return;
    }
    const { autoPanOnConnect, domNode, connectionMode, connectionRadius, lib, onConnectStart, cancelConnection, nodeLookup, rfId: flowId, panBy: panBy2, updateConnection } = store.getState();
    const isTarget = oppositeHandle.type === "target";
    const _onReconnectEnd = (evt, connectionState) => {
      setReconnecting(false);
      onReconnectEnd?.(evt, edge, oppositeHandle.type, connectionState);
    };
    const onConnectEdge = (connection) => onReconnect?.(edge, connection);
    const _onConnectStart = (_event, params) => {
      setReconnecting(true);
      onReconnectStart?.(event, edge, oppositeHandle.type);
      onConnectStart?.(_event, params);
    };
    XYHandle.onPointerDown(event.nativeEvent, {
      autoPanOnConnect,
      connectionMode,
      connectionRadius,
      domNode,
      handleId: oppositeHandle.id,
      nodeId: oppositeHandle.nodeId,
      nodeLookup,
      isTarget,
      edgeUpdaterType: oppositeHandle.type,
      lib,
      flowId,
      cancelConnection,
      panBy: panBy2,
      isValidConnection: (...args) => store.getState().isValidConnection?.(...args) ?? true,
      onConnect: onConnectEdge,
      onConnectStart: _onConnectStart,
      onConnectEnd: (...args) => store.getState().onConnectEnd?.(...args),
      onReconnectEnd: _onReconnectEnd,
      updateConnection,
      getTransform: () => store.getState().transform,
      getFromHandle: () => store.getState().connection.fromHandle,
      dragThreshold: store.getState().connectionDragThreshold,
      handleDomNode: event.currentTarget
    });
  };
  const onReconnectSourceMouseDown = (event) => handleEdgeUpdater(event, { nodeId: edge.target, id: edge.targetHandle ?? null, type: "target" });
  const onReconnectTargetMouseDown = (event) => handleEdgeUpdater(event, { nodeId: edge.source, id: edge.sourceHandle ?? null, type: "source" });
  const onReconnectMouseEnter = () => setUpdateHover(true);
  const onReconnectMouseOut = () => setUpdateHover(false);
  return (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [(isReconnectable === true || isReconnectable === "source") && (0, import_jsx_runtime3.jsx)(EdgeAnchor, { position: sourcePosition, centerX: sourceX, centerY: sourceY, radius: reconnectRadius, onMouseDown: onReconnectSourceMouseDown, onMouseEnter: onReconnectMouseEnter, onMouseOut: onReconnectMouseOut, type: "source" }), (isReconnectable === true || isReconnectable === "target") && (0, import_jsx_runtime3.jsx)(EdgeAnchor, { position: targetPosition, centerX: targetX, centerY: targetY, radius: reconnectRadius, onMouseDown: onReconnectTargetMouseDown, onMouseEnter: onReconnectMouseEnter, onMouseOut: onReconnectMouseOut, type: "target" })] });
}
function EdgeWrapper({ id: id2, edgesFocusable, edgesReconnectable, elementsSelectable, onClick, onDoubleClick, onContextMenu, onMouseEnter, onMouseMove, onMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, rfId, edgeTypes, noPanClassName, onError, disableKeyboardA11y }) {
  let edge = useStore((s) => s.edgeLookup.get(id2));
  const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
  edge = defaultEdgeOptions ? { ...defaultEdgeOptions, ...edge } : edge;
  let edgeType = edge.type || "default";
  let EdgeComponent = edgeTypes?.[edgeType] || builtinEdgeTypes[edgeType];
  if (EdgeComponent === void 0) {
    onError?.("011", errorMessages["error011"](edgeType));
    edgeType = "default";
    EdgeComponent = edgeTypes?.["default"] || builtinEdgeTypes.default;
  }
  const isFocusable = !!(edge.focusable || edgesFocusable && typeof edge.focusable === "undefined");
  const isReconnectable = typeof onReconnect !== "undefined" && (edge.reconnectable || edgesReconnectable && typeof edge.reconnectable === "undefined");
  const isSelectable = !!(edge.selectable || elementsSelectable && typeof edge.selectable === "undefined");
  const edgeRef = (0, import_react6.useRef)(null);
  const [updateHover, setUpdateHover] = (0, import_react6.useState)(false);
  const [reconnecting, setReconnecting] = (0, import_react6.useState)(false);
  const store = useStoreApi();
  const { zIndex, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = useStore((0, import_react6.useCallback)((store2) => {
    const sourceNode = store2.nodeLookup.get(edge.source);
    const targetNode = store2.nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      return {
        zIndex: edge.zIndex,
        ...nullPosition
      };
    }
    const edgePosition = getEdgePosition({
      id: id2,
      sourceNode,
      targetNode,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      connectionMode: store2.connectionMode,
      onError
    });
    const zIndex2 = getElevatedEdgeZIndex({
      selected: edge.selected,
      zIndex: edge.zIndex,
      sourceNode,
      targetNode,
      elevateOnSelect: store2.elevateEdgesOnSelect,
      zIndexMode: store2.zIndexMode
    });
    return {
      zIndex: zIndex2,
      ...edgePosition || nullPosition
    };
  }, [edge.source, edge.target, edge.sourceHandle, edge.targetHandle, edge.selected, edge.zIndex]), shallow$1);
  const markerStartUrl = (0, import_react6.useMemo)(() => edge.markerStart ? `url('#${getMarkerId(edge.markerStart, rfId)}')` : void 0, [edge.markerStart, rfId]);
  const markerEndUrl = (0, import_react6.useMemo)(() => edge.markerEnd ? `url('#${getMarkerId(edge.markerEnd, rfId)}')` : void 0, [edge.markerEnd, rfId]);
  if (edge.hidden || sourceX === null || sourceY === null || targetX === null || targetY === null) {
    return null;
  }
  const onEdgeClick = (event) => {
    const { addSelectedEdges, unselectNodesAndEdges, multiSelectionActive } = store.getState();
    if (isSelectable) {
      store.setState({ nodesSelectionActive: false });
      if (edge.selected && multiSelectionActive) {
        unselectNodesAndEdges({ nodes: [], edges: [edge] });
        edgeRef.current?.blur();
      } else {
        addSelectedEdges([id2]);
      }
    }
    if (onClick) {
      onClick(event, edge);
    }
  };
  const onEdgeDoubleClick = onDoubleClick ? (event) => {
    onDoubleClick(event, { ...edge });
  } : void 0;
  const onEdgeContextMenu = onContextMenu ? (event) => {
    onContextMenu(event, { ...edge });
  } : void 0;
  const onEdgeMouseEnter = onMouseEnter ? (event) => {
    onMouseEnter(event, { ...edge });
  } : void 0;
  const onEdgeMouseMove = onMouseMove ? (event) => {
    onMouseMove(event, { ...edge });
  } : void 0;
  const onEdgeMouseLeave = onMouseLeave ? (event) => {
    onMouseLeave(event, { ...edge });
  } : void 0;
  const onKeyDown = (event) => {
    if (!disableKeyboardA11y && elementSelectionKeys.includes(event.key) && isSelectable) {
      const { unselectNodesAndEdges, addSelectedEdges } = store.getState();
      const unselect = event.key === "Escape";
      if (unselect) {
        edgeRef.current?.blur();
        unselectNodesAndEdges({ edges: [edge] });
      } else {
        addSelectedEdges([id2]);
      }
    }
  };
  return (0, import_jsx_runtime3.jsx)("svg", { style: { zIndex }, children: (0, import_jsx_runtime3.jsxs)("g", { className: cc([
    "react-flow__edge",
    `react-flow__edge-${edgeType}`,
    edge.className,
    noPanClassName,
    {
      selected: edge.selected,
      animated: edge.animated,
      inactive: !isSelectable && !onClick,
      updating: updateHover,
      selectable: isSelectable
    }
  ]), onClick: onEdgeClick, onDoubleClick: onEdgeDoubleClick, onContextMenu: onEdgeContextMenu, onMouseEnter: onEdgeMouseEnter, onMouseMove: onEdgeMouseMove, onMouseLeave: onEdgeMouseLeave, onKeyDown: isFocusable ? onKeyDown : void 0, tabIndex: isFocusable ? 0 : void 0, role: edge.ariaRole ?? (isFocusable ? "group" : "img"), "aria-roledescription": "edge", "data-id": id2, "data-testid": `rf__edge-${id2}`, "aria-label": edge.ariaLabel === null ? void 0 : edge.ariaLabel || `Edge from ${edge.source} to ${edge.target}`, "aria-describedby": isFocusable ? `${ARIA_EDGE_DESC_KEY}-${rfId}` : void 0, ref: edgeRef, ...edge.domAttributes, children: [!reconnecting && (0, import_jsx_runtime3.jsx)(EdgeComponent, { id: id2, source: edge.source, target: edge.target, type: edge.type, selected: edge.selected, animated: edge.animated, selectable: isSelectable, deletable: edge.deletable ?? true, label: edge.label, labelStyle: edge.labelStyle, labelShowBg: edge.labelShowBg, labelBgStyle: edge.labelBgStyle, labelBgPadding: edge.labelBgPadding, labelBgBorderRadius: edge.labelBgBorderRadius, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data: edge.data, style: edge.style, sourceHandleId: edge.sourceHandle, targetHandleId: edge.targetHandle, markerStart: markerStartUrl, markerEnd: markerEndUrl, pathOptions: "pathOptions" in edge ? edge.pathOptions : void 0, interactionWidth: edge.interactionWidth }), isReconnectable && (0, import_jsx_runtime3.jsx)(EdgeUpdateAnchors, { edge, isReconnectable, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, setUpdateHover, setReconnecting })] }) });
}
var EdgeWrapper$1 = (0, import_react6.memo)(EdgeWrapper);
var selector$a = (s) => ({
  edgesFocusable: s.edgesFocusable,
  edgesReconnectable: s.edgesReconnectable,
  elementsSelectable: s.elementsSelectable,
  connectionMode: s.connectionMode,
  onError: s.onError
});
function EdgeRendererComponent({ defaultMarkerColor, onlyRenderVisibleElements, rfId, edgeTypes, noPanClassName, onReconnect, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, onEdgeClick, reconnectRadius, onEdgeDoubleClick, onReconnectStart, onReconnectEnd, disableKeyboardA11y }) {
  const { edgesFocusable, edgesReconnectable, elementsSelectable, onError } = useStore(selector$a, shallow$1);
  const edgeIds = useVisibleEdgeIds(onlyRenderVisibleElements);
  return (0, import_jsx_runtime3.jsxs)("div", { className: "react-flow__edges", children: [(0, import_jsx_runtime3.jsx)(MarkerDefinitions$1, { defaultColor: defaultMarkerColor, rfId }), edgeIds.map((id2) => {
    return (0, import_jsx_runtime3.jsx)(EdgeWrapper$1, { id: id2, edgesFocusable, edgesReconnectable, elementsSelectable, noPanClassName, onReconnect, onContextMenu: onEdgeContextMenu, onMouseEnter: onEdgeMouseEnter, onMouseMove: onEdgeMouseMove, onMouseLeave: onEdgeMouseLeave, onClick: onEdgeClick, reconnectRadius, onDoubleClick: onEdgeDoubleClick, onReconnectStart, onReconnectEnd, rfId, onError, edgeTypes, disableKeyboardA11y }, id2);
  })] });
}
EdgeRendererComponent.displayName = "EdgeRenderer";
var EdgeRenderer = (0, import_react6.memo)(EdgeRendererComponent);
var selector$9 = (s) => `translate(${s.transform[0]}px,${s.transform[1]}px) scale(${s.transform[2]})`;
function Viewport({ children: children2 }) {
  const transform2 = useStore(selector$9);
  return (0, import_jsx_runtime3.jsx)("div", { className: "react-flow__viewport xyflow__viewport react-flow__container", style: { transform: transform2 }, children: children2 });
}
function useOnInitHandler(onInit) {
  const rfInstance = useReactFlow();
  const isInitialized = (0, import_react6.useRef)(false);
  (0, import_react6.useEffect)(() => {
    if (!isInitialized.current && rfInstance.viewportInitialized && onInit) {
      setTimeout(() => onInit(rfInstance), 1);
      isInitialized.current = true;
    }
  }, [onInit, rfInstance.viewportInitialized]);
}
var selector$8 = (state) => state.panZoom?.syncViewport;
function useViewportSync(viewport) {
  const syncViewport = useStore(selector$8);
  const store = useStoreApi();
  (0, import_react6.useEffect)(() => {
    if (viewport) {
      syncViewport?.(viewport);
      store.setState({ transform: [viewport.x, viewport.y, viewport.zoom] });
    }
  }, [viewport, syncViewport]);
  return null;
}
function storeSelector$1(s) {
  return s.connection.inProgress ? { ...s.connection, to: pointToRendererPoint(s.connection.to, s.transform) } : { ...s.connection };
}
function getSelector(connectionSelector) {
  if (connectionSelector) {
    const combinedSelector = (s) => {
      const connection = storeSelector$1(s);
      return connectionSelector(connection);
    };
    return combinedSelector;
  }
  return storeSelector$1;
}
function useConnection(connectionSelector) {
  const combinedSelector = getSelector(connectionSelector);
  return useStore(combinedSelector, shallow$1);
}
var selector$7 = (s) => ({
  nodesConnectable: s.nodesConnectable,
  isValid: s.connection.isValid,
  inProgress: s.connection.inProgress,
  width: s.width,
  height: s.height
});
function ConnectionLineWrapper({ containerStyle: containerStyle2, style: style2, type, component }) {
  const { nodesConnectable, width, height, isValid, inProgress } = useStore(selector$7, shallow$1);
  const renderConnection = !!(width && nodesConnectable && inProgress);
  if (!renderConnection) {
    return null;
  }
  return (0, import_jsx_runtime3.jsx)("svg", { style: containerStyle2, width, height, className: "react-flow__connectionline react-flow__container", children: (0, import_jsx_runtime3.jsx)("g", { className: cc(["react-flow__connection", getConnectionStatus(isValid)]), children: (0, import_jsx_runtime3.jsx)(ConnectionLine, { style: style2, type, CustomComponent: component, isValid }) }) });
}
var ConnectionLine = ({ style: style2, type = ConnectionLineType.Bezier, CustomComponent, isValid }) => {
  const { inProgress, from, fromNode, fromHandle, fromPosition, to, toNode, toHandle, toPosition, pointer } = useConnection();
  if (!inProgress) {
    return;
  }
  if (CustomComponent) {
    return (0, import_jsx_runtime3.jsx)(CustomComponent, { connectionLineType: type, connectionLineStyle: style2, fromNode, fromHandle, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, fromPosition, toPosition, connectionStatus: getConnectionStatus(isValid), toNode, toHandle, pointer });
  }
  let path = "";
  const pathParams = {
    sourceX: from.x,
    sourceY: from.y,
    sourcePosition: fromPosition,
    targetX: to.x,
    targetY: to.y,
    targetPosition: toPosition
  };
  switch (type) {
    case ConnectionLineType.Bezier:
      [path] = getBezierPath(pathParams);
      break;
    case ConnectionLineType.SimpleBezier:
      [path] = getSimpleBezierPath(pathParams);
      break;
    case ConnectionLineType.Step:
      [path] = getSmoothStepPath({
        ...pathParams,
        borderRadius: 0
      });
      break;
    case ConnectionLineType.SmoothStep:
      [path] = getSmoothStepPath(pathParams);
      break;
    default:
      [path] = getStraightPath(pathParams);
  }
  return (0, import_jsx_runtime3.jsx)("path", { d: path, fill: "none", className: "react-flow__connection-path", style: style2 });
};
ConnectionLine.displayName = "ConnectionLine";
var emptyTypes = {};
function useNodeOrEdgeTypesWarning(nodeOrEdgeTypes = emptyTypes) {
  const typesRef = (0, import_react6.useRef)(nodeOrEdgeTypes);
  const store = useStoreApi();
  (0, import_react6.useEffect)(() => {
    if (true) {
      const usedKeys = /* @__PURE__ */ new Set([...Object.keys(typesRef.current), ...Object.keys(nodeOrEdgeTypes)]);
      for (const key of usedKeys) {
        if (typesRef.current[key] !== nodeOrEdgeTypes[key]) {
          store.getState().onError?.("002", errorMessages["error002"]());
          break;
        }
      }
      typesRef.current = nodeOrEdgeTypes;
    }
  }, [nodeOrEdgeTypes]);
}
function useStylesLoadedWarning() {
  const store = useStoreApi();
  const checked = (0, import_react6.useRef)(false);
  (0, import_react6.useEffect)(() => {
    if (true) {
      if (!checked.current) {
        const pane = document.querySelector(".react-flow__pane");
        if (pane && !(window.getComputedStyle(pane).zIndex === "1")) {
          store.getState().onError?.("013", errorMessages["error013"]("react"));
        }
        checked.current = true;
      }
    }
  }, []);
}
function GraphViewComponent({ nodeTypes, edgeTypes, onInit, onNodeClick, onEdgeClick, onNodeDoubleClick, onEdgeDoubleClick, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onSelectionContextMenu, onSelectionStart, onSelectionEnd, connectionLineType, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, selectionKeyCode, selectionOnDrag, selectionMode, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, deleteKeyCode, onlyRenderVisibleElements, elementsSelectable, defaultViewport: defaultViewport2, translateExtent, minZoom, maxZoom, preventScrolling, defaultMarkerColor, zoomOnScroll, zoomOnPinch, panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance, nodeClickDistance, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, noDragClassName, noWheelClassName, noPanClassName, disableKeyboardA11y, nodeExtent, rfId, viewport, onViewportChange }) {
  useNodeOrEdgeTypesWarning(nodeTypes);
  useNodeOrEdgeTypesWarning(edgeTypes);
  useStylesLoadedWarning();
  useOnInitHandler(onInit);
  useViewportSync(viewport);
  return (0, import_jsx_runtime3.jsx)(FlowRenderer, { onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneContextMenu, onPaneScroll, paneClickDistance, deleteKeyCode, selectionKeyCode, selectionOnDrag, selectionMode, onSelectionStart, onSelectionEnd, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, elementsSelectable, zoomOnScroll, zoomOnPinch, zoomOnDoubleClick, panOnScroll, panOnScrollSpeed, panOnScrollMode, panOnDrag, defaultViewport: defaultViewport2, translateExtent, minZoom, maxZoom, onSelectionContextMenu, preventScrolling, noDragClassName, noWheelClassName, noPanClassName, disableKeyboardA11y, onViewportChange, isControlledViewport: !!viewport, children: (0, import_jsx_runtime3.jsxs)(Viewport, { children: [(0, import_jsx_runtime3.jsx)(EdgeRenderer, { edgeTypes, onEdgeClick, onEdgeDoubleClick, onReconnect, onReconnectStart, onReconnectEnd, onlyRenderVisibleElements, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius, defaultMarkerColor, noPanClassName, disableKeyboardA11y, rfId }), (0, import_jsx_runtime3.jsx)(ConnectionLineWrapper, { style: connectionLineStyle, type: connectionLineType, component: connectionLineComponent, containerStyle: connectionLineContainerStyle }), (0, import_jsx_runtime3.jsx)("div", { className: "react-flow__edgelabel-renderer" }), (0, import_jsx_runtime3.jsx)(NodeRenderer, { nodeTypes, onNodeClick, onNodeDoubleClick, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, nodeClickDistance, onlyRenderVisibleElements, noPanClassName, noDragClassName, disableKeyboardA11y, nodeExtent, rfId }), (0, import_jsx_runtime3.jsx)("div", { className: "react-flow__viewport-portal" })] }) });
}
GraphViewComponent.displayName = "GraphView";
var GraphView = (0, import_react6.memo)(GraphViewComponent);
var getInitialState = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom = 0.5, maxZoom = 2, nodeOrigin, nodeExtent, zIndexMode = "basic" } = {}) => {
  const nodeLookup = /* @__PURE__ */ new Map();
  const parentLookup = /* @__PURE__ */ new Map();
  const connectionLookup = /* @__PURE__ */ new Map();
  const edgeLookup = /* @__PURE__ */ new Map();
  const storeEdges = defaultEdges ?? edges ?? [];
  const storeNodes = defaultNodes ?? nodes ?? [];
  const storeNodeOrigin = nodeOrigin ?? [0, 0];
  const storeNodeExtent = nodeExtent ?? infiniteExtent;
  updateConnectionLookup(connectionLookup, edgeLookup, storeEdges);
  const nodesInitialized = adoptUserNodes(storeNodes, nodeLookup, parentLookup, {
    nodeOrigin: storeNodeOrigin,
    nodeExtent: storeNodeExtent,
    zIndexMode
  });
  let transform2 = [0, 0, 1];
  if (fitView && width && height) {
    const bounds = getInternalNodesBounds(nodeLookup, {
      filter: (node) => !!((node.width || node.initialWidth) && (node.height || node.initialHeight))
    });
    const { x, y, zoom } = getViewportForBounds(bounds, width, height, minZoom, maxZoom, fitViewOptions?.padding ?? 0.1);
    transform2 = [x, y, zoom];
  }
  return {
    rfId: "1",
    width: width ?? 0,
    height: height ?? 0,
    transform: transform2,
    nodes: storeNodes,
    nodesInitialized,
    nodeLookup,
    parentLookup,
    edges: storeEdges,
    edgeLookup,
    connectionLookup,
    onNodesChange: null,
    onEdgesChange: null,
    hasDefaultNodes: defaultNodes !== void 0,
    hasDefaultEdges: defaultEdges !== void 0,
    panZoom: null,
    minZoom,
    maxZoom,
    translateExtent: infiniteExtent,
    nodeExtent: storeNodeExtent,
    nodesSelectionActive: false,
    userSelectionActive: false,
    userSelectionRect: null,
    connectionMode: ConnectionMode.Strict,
    domNode: null,
    paneDragging: false,
    noPanClassName: "nopan",
    nodeOrigin: storeNodeOrigin,
    nodeDragThreshold: 1,
    connectionDragThreshold: 1,
    snapGrid: [15, 15],
    snapToGrid: false,
    nodesDraggable: true,
    nodesConnectable: true,
    nodesFocusable: true,
    edgesFocusable: true,
    edgesReconnectable: true,
    elementsSelectable: true,
    elevateNodesOnSelect: true,
    elevateEdgesOnSelect: true,
    selectNodesOnDrag: true,
    multiSelectionActive: false,
    fitViewQueued: fitView ?? false,
    fitViewOptions,
    fitViewResolver: null,
    connection: { ...initialConnection },
    connectionClickStartHandle: null,
    connectOnClick: true,
    ariaLiveMessage: "",
    autoPanOnConnect: true,
    autoPanOnNodeDrag: true,
    autoPanOnNodeFocus: true,
    autoPanSpeed: 15,
    connectionRadius: 20,
    onError: devWarn,
    isValidConnection: void 0,
    onSelectionChangeHandlers: [],
    lib: "react",
    debug: false,
    ariaLabelConfig: defaultAriaLabelConfig,
    zIndexMode,
    onNodesChangeMiddlewareMap: /* @__PURE__ */ new Map(),
    onEdgesChangeMiddlewareMap: /* @__PURE__ */ new Map()
  };
};
var createStore2 = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, zIndexMode }) => createWithEqualityFn((set3, get3) => {
  async function resolveFitView() {
    const { nodeLookup, panZoom, fitViewOptions: fitViewOptions2, fitViewResolver, width: width2, height: height2, minZoom: minZoom2, maxZoom: maxZoom2 } = get3();
    if (!panZoom) {
      return;
    }
    await fitViewport({
      nodes: nodeLookup,
      width: width2,
      height: height2,
      panZoom,
      minZoom: minZoom2,
      maxZoom: maxZoom2
    }, fitViewOptions2);
    fitViewResolver?.resolve(true);
    set3({ fitViewResolver: null });
  }
  return {
    ...getInitialState({
      nodes,
      edges,
      width,
      height,
      fitView,
      fitViewOptions,
      minZoom,
      maxZoom,
      nodeOrigin,
      nodeExtent,
      defaultNodes,
      defaultEdges,
      zIndexMode
    }),
    setNodes: (nodes2) => {
      const { nodeLookup, parentLookup, nodeOrigin: nodeOrigin2, elevateNodesOnSelect, fitViewQueued, zIndexMode: zIndexMode2 } = get3();
      const nodesInitialized = adoptUserNodes(nodes2, nodeLookup, parentLookup, {
        nodeOrigin: nodeOrigin2,
        nodeExtent,
        elevateNodesOnSelect,
        checkEquality: true,
        zIndexMode: zIndexMode2
      });
      if (fitViewQueued && nodesInitialized) {
        resolveFitView();
        set3({ nodes: nodes2, nodesInitialized, fitViewQueued: false, fitViewOptions: void 0 });
      } else {
        set3({ nodes: nodes2, nodesInitialized });
      }
    },
    setEdges: (edges2) => {
      const { connectionLookup, edgeLookup } = get3();
      updateConnectionLookup(connectionLookup, edgeLookup, edges2);
      set3({ edges: edges2 });
    },
    setDefaultNodesAndEdges: (nodes2, edges2) => {
      if (nodes2) {
        const { setNodes } = get3();
        setNodes(nodes2);
        set3({ hasDefaultNodes: true });
      }
      if (edges2) {
        const { setEdges } = get3();
        setEdges(edges2);
        set3({ hasDefaultEdges: true });
      }
    },
    /*
     * Every node gets registerd at a ResizeObserver. Whenever a node
     * changes its dimensions, this function is called to measure the
     * new dimensions and update the nodes.
     */
    updateNodeInternals: (updates) => {
      const { triggerNodeChanges, nodeLookup, parentLookup, domNode, nodeOrigin: nodeOrigin2, nodeExtent: nodeExtent2, debug, fitViewQueued, zIndexMode: zIndexMode2 } = get3();
      const { changes, updatedInternals } = updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin2, nodeExtent2, zIndexMode2);
      if (!updatedInternals) {
        return;
      }
      updateAbsolutePositions(nodeLookup, parentLookup, { nodeOrigin: nodeOrigin2, nodeExtent: nodeExtent2, zIndexMode: zIndexMode2 });
      if (fitViewQueued) {
        resolveFitView();
        set3({ fitViewQueued: false, fitViewOptions: void 0 });
      } else {
        set3({});
      }
      if (changes?.length > 0) {
        if (debug) {
          console.log("React Flow: trigger node changes", changes);
        }
        triggerNodeChanges?.(changes);
      }
    },
    updateNodePositions: (nodeDragItems, dragging = false) => {
      const parentExpandChildren = [];
      let changes = [];
      const { nodeLookup, triggerNodeChanges, connection, updateConnection, onNodesChangeMiddlewareMap } = get3();
      for (const [id2, dragItem] of nodeDragItems) {
        const node = nodeLookup.get(id2);
        const expandParent = !!(node?.expandParent && node?.parentId && dragItem?.position);
        const change = {
          id: id2,
          type: "position",
          position: expandParent ? {
            x: Math.max(0, dragItem.position.x),
            y: Math.max(0, dragItem.position.y)
          } : dragItem.position,
          dragging
        };
        if (node && connection.inProgress && connection.fromNode.id === node.id) {
          const updatedFrom = getHandlePosition(node, connection.fromHandle, Position.Left, true);
          updateConnection({ ...connection, from: updatedFrom });
        }
        if (expandParent && node.parentId) {
          parentExpandChildren.push({
            id: id2,
            parentId: node.parentId,
            rect: {
              ...dragItem.internals.positionAbsolute,
              width: dragItem.measured.width ?? 0,
              height: dragItem.measured.height ?? 0
            }
          });
        }
        changes.push(change);
      }
      if (parentExpandChildren.length > 0) {
        const { parentLookup, nodeOrigin: nodeOrigin2 } = get3();
        const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin2);
        changes.push(...parentExpandChanges);
      }
      for (const middleware of onNodesChangeMiddlewareMap.values()) {
        changes = middleware(changes);
      }
      triggerNodeChanges(changes);
    },
    triggerNodeChanges: (changes) => {
      const { onNodesChange, setNodes, nodes: nodes2, hasDefaultNodes, debug } = get3();
      if (changes?.length) {
        if (hasDefaultNodes) {
          const updatedNodes = applyNodeChanges(changes, nodes2);
          setNodes(updatedNodes);
        }
        if (debug) {
          console.log("React Flow: trigger node changes", changes);
        }
        onNodesChange?.(changes);
      }
    },
    triggerEdgeChanges: (changes) => {
      const { onEdgesChange, setEdges, edges: edges2, hasDefaultEdges, debug } = get3();
      if (changes?.length) {
        if (hasDefaultEdges) {
          const updatedEdges = applyEdgeChanges(changes, edges2);
          setEdges(updatedEdges);
        }
        if (debug) {
          console.log("React Flow: trigger edge changes", changes);
        }
        onEdgesChange?.(changes);
      }
    },
    addSelectedNodes: (selectedNodeIds) => {
      const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get3();
      if (multiSelectionActive) {
        const nodeChanges = selectedNodeIds.map((nodeId) => createSelectionChange(nodeId, true));
        triggerNodeChanges(nodeChanges);
        return;
      }
      triggerNodeChanges(getSelectionChanges(nodeLookup, /* @__PURE__ */ new Set([...selectedNodeIds]), true));
      triggerEdgeChanges(getSelectionChanges(edgeLookup));
    },
    addSelectedEdges: (selectedEdgeIds) => {
      const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get3();
      if (multiSelectionActive) {
        const changedEdges = selectedEdgeIds.map((edgeId) => createSelectionChange(edgeId, true));
        triggerEdgeChanges(changedEdges);
        return;
      }
      triggerEdgeChanges(getSelectionChanges(edgeLookup, /* @__PURE__ */ new Set([...selectedEdgeIds])));
      triggerNodeChanges(getSelectionChanges(nodeLookup, /* @__PURE__ */ new Set(), true));
    },
    unselectNodesAndEdges: ({ nodes: nodes2, edges: edges2 } = {}) => {
      const { edges: storeEdges, nodes: storeNodes, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get3();
      const nodesToUnselect = nodes2 ? nodes2 : storeNodes;
      const edgesToUnselect = edges2 ? edges2 : storeEdges;
      const nodeChanges = [];
      for (const node of nodesToUnselect) {
        if (!node.selected) {
          continue;
        }
        const internalNode = nodeLookup.get(node.id);
        if (internalNode) {
          internalNode.selected = false;
        }
        nodeChanges.push(createSelectionChange(node.id, false));
      }
      const edgeChanges = [];
      for (const edge of edgesToUnselect) {
        if (!edge.selected) {
          continue;
        }
        edgeChanges.push(createSelectionChange(edge.id, false));
      }
      triggerNodeChanges(nodeChanges);
      triggerEdgeChanges(edgeChanges);
    },
    setMinZoom: (minZoom2) => {
      const { panZoom, maxZoom: maxZoom2 } = get3();
      panZoom?.setScaleExtent([minZoom2, maxZoom2]);
      set3({ minZoom: minZoom2 });
    },
    setMaxZoom: (maxZoom2) => {
      const { panZoom, minZoom: minZoom2 } = get3();
      panZoom?.setScaleExtent([minZoom2, maxZoom2]);
      set3({ maxZoom: maxZoom2 });
    },
    setTranslateExtent: (translateExtent) => {
      get3().panZoom?.setTranslateExtent(translateExtent);
      set3({ translateExtent });
    },
    resetSelectedElements: () => {
      const { edges: edges2, nodes: nodes2, triggerNodeChanges, triggerEdgeChanges, elementsSelectable } = get3();
      if (!elementsSelectable) {
        return;
      }
      const nodeChanges = nodes2.reduce((res, node) => node.selected ? [...res, createSelectionChange(node.id, false)] : res, []);
      const edgeChanges = edges2.reduce((res, edge) => edge.selected ? [...res, createSelectionChange(edge.id, false)] : res, []);
      triggerNodeChanges(nodeChanges);
      triggerEdgeChanges(edgeChanges);
    },
    setNodeExtent: (nextNodeExtent) => {
      const { nodes: nodes2, nodeLookup, parentLookup, nodeOrigin: nodeOrigin2, elevateNodesOnSelect, nodeExtent: nodeExtent2, zIndexMode: zIndexMode2 } = get3();
      if (nextNodeExtent[0][0] === nodeExtent2[0][0] && nextNodeExtent[0][1] === nodeExtent2[0][1] && nextNodeExtent[1][0] === nodeExtent2[1][0] && nextNodeExtent[1][1] === nodeExtent2[1][1]) {
        return;
      }
      adoptUserNodes(nodes2, nodeLookup, parentLookup, {
        nodeOrigin: nodeOrigin2,
        nodeExtent: nextNodeExtent,
        elevateNodesOnSelect,
        checkEquality: false,
        zIndexMode: zIndexMode2
      });
      set3({ nodeExtent: nextNodeExtent });
    },
    panBy: (delta) => {
      const { transform: transform2, width: width2, height: height2, panZoom, translateExtent } = get3();
      return panBy({ delta, panZoom, transform: transform2, translateExtent, width: width2, height: height2 });
    },
    setCenter: async (x, y, options) => {
      const { width: width2, height: height2, maxZoom: maxZoom2, panZoom } = get3();
      if (!panZoom) {
        return Promise.resolve(false);
      }
      const nextZoom = typeof options?.zoom !== "undefined" ? options.zoom : maxZoom2;
      await panZoom.setViewport({
        x: width2 / 2 - x * nextZoom,
        y: height2 / 2 - y * nextZoom,
        zoom: nextZoom
      }, { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate });
      return Promise.resolve(true);
    },
    cancelConnection: () => {
      set3({
        connection: { ...initialConnection }
      });
    },
    updateConnection: (connection) => {
      set3({ connection });
    },
    reset: () => set3({ ...getInitialState() })
  };
}, Object.is);
function ReactFlowProvider({ initialNodes: nodes, initialEdges: edges, defaultNodes, defaultEdges, initialWidth: width, initialHeight: height, initialMinZoom: minZoom, initialMaxZoom: maxZoom, initialFitViewOptions: fitViewOptions, fitView, nodeOrigin, nodeExtent, zIndexMode, children: children2 }) {
  const [store] = (0, import_react6.useState)(() => createStore2({
    nodes,
    edges,
    defaultNodes,
    defaultEdges,
    width,
    height,
    fitView,
    minZoom,
    maxZoom,
    fitViewOptions,
    nodeOrigin,
    nodeExtent,
    zIndexMode
  }));
  return (0, import_jsx_runtime3.jsx)(Provider$1, { value: store, children: (0, import_jsx_runtime3.jsx)(BatchProvider, { children: children2 }) });
}
function Wrapper({ children: children2, nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, zIndexMode }) {
  const isWrapped = (0, import_react6.useContext)(StoreContext);
  if (isWrapped) {
    return (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: children2 });
  }
  return (0, import_jsx_runtime3.jsx)(ReactFlowProvider, { initialNodes: nodes, initialEdges: edges, defaultNodes, defaultEdges, initialWidth: width, initialHeight: height, fitView, initialFitViewOptions: fitViewOptions, initialMinZoom: minZoom, initialMaxZoom: maxZoom, nodeOrigin, nodeExtent, zIndexMode, children: children2 });
}
var wrapperStyle = {
  width: "100%",
  height: "100%",
  overflow: "hidden",
  position: "relative",
  zIndex: 0
};
function ReactFlow({ nodes, edges, defaultNodes, defaultEdges, className, nodeTypes, edgeTypes, onNodeClick, onEdgeClick, onInit, onMove, onMoveStart, onMoveEnd, onConnect, onConnectStart, onConnectEnd, onClickConnectStart, onClickConnectEnd, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onNodeDoubleClick, onNodeDragStart, onNodeDrag, onNodeDragStop, onNodesDelete, onEdgesDelete, onDelete, onSelectionChange, onSelectionDragStart, onSelectionDrag, onSelectionDragStop, onSelectionContextMenu, onSelectionStart, onSelectionEnd, onBeforeDelete, connectionMode, connectionLineType = ConnectionLineType.Bezier, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, deleteKeyCode = "Backspace", selectionKeyCode = "Shift", selectionOnDrag = false, selectionMode = SelectionMode.Full, panActivationKeyCode = "Space", multiSelectionKeyCode = isMacOs() ? "Meta" : "Control", zoomActivationKeyCode = isMacOs() ? "Meta" : "Control", snapToGrid, snapGrid, onlyRenderVisibleElements = false, selectNodesOnDrag, nodesDraggable, autoPanOnNodeFocus, nodesConnectable, nodesFocusable, nodeOrigin = defaultNodeOrigin, edgesFocusable, edgesReconnectable, elementsSelectable = true, defaultViewport: defaultViewport$1 = defaultViewport, minZoom = 0.5, maxZoom = 2, translateExtent = infiniteExtent, preventScrolling = true, nodeExtent, defaultMarkerColor = "#b1b1b7", zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panOnScrollSpeed = 0.5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance = 1, nodeClickDistance = 0, children: children2, onReconnect, onReconnectStart, onReconnectEnd, onEdgeContextMenu, onEdgeDoubleClick, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius = 10, onNodesChange, onEdgesChange, noDragClassName = "nodrag", noWheelClassName = "nowheel", noPanClassName = "nopan", fitView, fitViewOptions, connectOnClick, attributionPosition, proOptions, defaultEdgeOptions, elevateNodesOnSelect = true, elevateEdgesOnSelect = false, disableKeyboardA11y = false, autoPanOnConnect, autoPanOnNodeDrag, autoPanSpeed, connectionRadius, isValidConnection, onError, style: style2, id: id2, nodeDragThreshold, connectionDragThreshold, viewport, onViewportChange, width, height, colorMode = "light", debug, onScroll, ariaLabelConfig, zIndexMode = "basic", ...rest }, ref) {
  const rfId = id2 || "1";
  const colorModeClassName = useColorModeClass(colorMode);
  const wrapperOnScroll = (0, import_react6.useCallback)((e) => {
    e.currentTarget.scrollTo({ top: 0, left: 0, behavior: "instant" });
    onScroll?.(e);
  }, [onScroll]);
  return (0, import_jsx_runtime3.jsx)("div", { "data-testid": "rf__wrapper", ...rest, onScroll: wrapperOnScroll, style: { ...style2, ...wrapperStyle }, ref, className: cc(["react-flow", className, colorModeClassName]), id: id2, role: "application", children: (0, import_jsx_runtime3.jsxs)(Wrapper, { nodes, edges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, zIndexMode, children: [(0, import_jsx_runtime3.jsx)(GraphView, { onInit, onNodeClick, onEdgeClick, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onNodeDoubleClick, nodeTypes, edgeTypes, connectionLineType, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, selectionKeyCode, selectionOnDrag, selectionMode, deleteKeyCode, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, onlyRenderVisibleElements, defaultViewport: defaultViewport$1, translateExtent, minZoom, maxZoom, preventScrolling, zoomOnScroll, zoomOnPinch, zoomOnDoubleClick, panOnScroll, panOnScrollSpeed, panOnScrollMode, panOnDrag, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance, nodeClickDistance, onSelectionContextMenu, onSelectionStart, onSelectionEnd, onReconnect, onReconnectStart, onReconnectEnd, onEdgeContextMenu, onEdgeDoubleClick, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius, defaultMarkerColor, noDragClassName, noWheelClassName, noPanClassName, rfId, disableKeyboardA11y, nodeExtent, viewport, onViewportChange }), (0, import_jsx_runtime3.jsx)(StoreUpdater, { nodes, edges, defaultNodes, defaultEdges, onConnect, onConnectStart, onConnectEnd, onClickConnectStart, onClickConnectEnd, nodesDraggable, autoPanOnNodeFocus, nodesConnectable, nodesFocusable, edgesFocusable, edgesReconnectable, elementsSelectable, elevateNodesOnSelect, elevateEdgesOnSelect, minZoom, maxZoom, nodeExtent, onNodesChange, onEdgesChange, snapToGrid, snapGrid, connectionMode, translateExtent, connectOnClick, defaultEdgeOptions, fitView, fitViewOptions, onNodesDelete, onEdgesDelete, onDelete, onNodeDragStart, onNodeDrag, onNodeDragStop, onSelectionDrag, onSelectionDragStart, onSelectionDragStop, onMove, onMoveStart, onMoveEnd, noPanClassName, nodeOrigin, rfId, autoPanOnConnect, autoPanOnNodeDrag, autoPanSpeed, onError, connectionRadius, isValidConnection, selectNodesOnDrag, nodeDragThreshold, connectionDragThreshold, onBeforeDelete, debug, ariaLabelConfig, zIndexMode }), (0, import_jsx_runtime3.jsx)(SelectionListener, { onSelectionChange }), children2, (0, import_jsx_runtime3.jsx)(Attribution, { proOptions, position: attributionPosition }), (0, import_jsx_runtime3.jsx)(A11yDescriptions, { rfId, disableKeyboardA11y })] }) });
}
var index = fixedForwardRef(ReactFlow);
var error014 = errorMessages["error014"]();
function LinePattern({ dimensions, lineWidth, variant, className }) {
  return (0, import_jsx_runtime3.jsx)("path", { strokeWidth: lineWidth, d: `M${dimensions[0] / 2} 0 V${dimensions[1]} M0 ${dimensions[1] / 2} H${dimensions[0]}`, className: cc(["react-flow__background-pattern", variant, className]) });
}
function DotPattern({ radius, className }) {
  return (0, import_jsx_runtime3.jsx)("circle", { cx: radius, cy: radius, r: radius, className: cc(["react-flow__background-pattern", "dots", className]) });
}
var BackgroundVariant;
(function(BackgroundVariant2) {
  BackgroundVariant2["Lines"] = "lines";
  BackgroundVariant2["Dots"] = "dots";
  BackgroundVariant2["Cross"] = "cross";
})(BackgroundVariant || (BackgroundVariant = {}));
var defaultSize = {
  [BackgroundVariant.Dots]: 1,
  [BackgroundVariant.Lines]: 1,
  [BackgroundVariant.Cross]: 6
};
var selector$3 = (s) => ({ transform: s.transform, patternId: `pattern-${s.rfId}` });
function BackgroundComponent({
  id: id2,
  variant = BackgroundVariant.Dots,
  // only used for dots and cross
  gap = 20,
  // only used for lines and cross
  size,
  lineWidth = 1,
  offset = 0,
  color: color2,
  bgColor,
  style: style2,
  className,
  patternClassName
}) {
  const ref = (0, import_react6.useRef)(null);
  const { transform: transform2, patternId } = useStore(selector$3, shallow$1);
  const patternSize = size || defaultSize[variant];
  const isDots = variant === BackgroundVariant.Dots;
  const isCross = variant === BackgroundVariant.Cross;
  const gapXY = Array.isArray(gap) ? gap : [gap, gap];
  const scaledGap = [gapXY[0] * transform2[2] || 1, gapXY[1] * transform2[2] || 1];
  const scaledSize = patternSize * transform2[2];
  const offsetXY = Array.isArray(offset) ? offset : [offset, offset];
  const patternDimensions = isCross ? [scaledSize, scaledSize] : scaledGap;
  const scaledOffset = [
    offsetXY[0] * transform2[2] || 1 + patternDimensions[0] / 2,
    offsetXY[1] * transform2[2] || 1 + patternDimensions[1] / 2
  ];
  const _patternId = `${patternId}${id2 ? id2 : ""}`;
  return (0, import_jsx_runtime3.jsxs)("svg", { className: cc(["react-flow__background", className]), style: {
    ...style2,
    ...containerStyle,
    "--xy-background-color-props": bgColor,
    "--xy-background-pattern-color-props": color2
  }, ref, "data-testid": "rf__background", children: [(0, import_jsx_runtime3.jsx)("pattern", { id: _patternId, x: transform2[0] % scaledGap[0], y: transform2[1] % scaledGap[1], width: scaledGap[0], height: scaledGap[1], patternUnits: "userSpaceOnUse", patternTransform: `translate(-${scaledOffset[0]},-${scaledOffset[1]})`, children: isDots ? (0, import_jsx_runtime3.jsx)(DotPattern, { radius: scaledSize / 2, className: patternClassName }) : (0, import_jsx_runtime3.jsx)(LinePattern, { dimensions: patternDimensions, lineWidth, variant, className: patternClassName }) }), (0, import_jsx_runtime3.jsx)("rect", { x: "0", y: "0", width: "100%", height: "100%", fill: `url(#${_patternId})` })] });
}
BackgroundComponent.displayName = "Background";
var Background = (0, import_react6.memo)(BackgroundComponent);
function PlusIcon() {
  return (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 32", children: (0, import_jsx_runtime3.jsx)("path", { d: "M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" }) });
}
function MinusIcon() {
  return (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 5", children: (0, import_jsx_runtime3.jsx)("path", { d: "M0 0h32v4.2H0z" }) });
}
function FitViewIcon() {
  return (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 30", children: (0, import_jsx_runtime3.jsx)("path", { d: "M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" }) });
}
function LockIcon() {
  return (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 25 32", children: (0, import_jsx_runtime3.jsx)("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z" }) });
}
function UnlockIcon() {
  return (0, import_jsx_runtime3.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 25 32", children: (0, import_jsx_runtime3.jsx)("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z" }) });
}
function ControlButton({ children: children2, className, ...rest }) {
  return (0, import_jsx_runtime3.jsx)("button", { type: "button", className: cc(["react-flow__controls-button", className]), ...rest, children: children2 });
}
var selector$2 = (s) => ({
  isInteractive: s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
  minZoomReached: s.transform[2] <= s.minZoom,
  maxZoomReached: s.transform[2] >= s.maxZoom,
  ariaLabelConfig: s.ariaLabelConfig
});
function ControlsComponent({ style: style2, showZoom = true, showFitView = true, showInteractive = true, fitViewOptions, onZoomIn, onZoomOut, onFitView, onInteractiveChange, className, children: children2, position = "bottom-left", orientation = "vertical", "aria-label": ariaLabel }) {
  const store = useStoreApi();
  const { isInteractive, minZoomReached, maxZoomReached, ariaLabelConfig } = useStore(selector$2, shallow$1);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const onZoomInHandler = () => {
    zoomIn();
    onZoomIn?.();
  };
  const onZoomOutHandler = () => {
    zoomOut();
    onZoomOut?.();
  };
  const onFitViewHandler = () => {
    fitView(fitViewOptions);
    onFitView?.();
  };
  const onToggleInteractivity = () => {
    store.setState({
      nodesDraggable: !isInteractive,
      nodesConnectable: !isInteractive,
      elementsSelectable: !isInteractive
    });
    onInteractiveChange?.(!isInteractive);
  };
  const orientationClass = orientation === "horizontal" ? "horizontal" : "vertical";
  return (0, import_jsx_runtime3.jsxs)(Panel, { className: cc(["react-flow__controls", orientationClass, className]), position, style: style2, "data-testid": "rf__controls", "aria-label": ariaLabel ?? ariaLabelConfig["controls.ariaLabel"], children: [showZoom && (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [(0, import_jsx_runtime3.jsx)(ControlButton, { onClick: onZoomInHandler, className: "react-flow__controls-zoomin", title: ariaLabelConfig["controls.zoomIn.ariaLabel"], "aria-label": ariaLabelConfig["controls.zoomIn.ariaLabel"], disabled: maxZoomReached, children: (0, import_jsx_runtime3.jsx)(PlusIcon, {}) }), (0, import_jsx_runtime3.jsx)(ControlButton, { onClick: onZoomOutHandler, className: "react-flow__controls-zoomout", title: ariaLabelConfig["controls.zoomOut.ariaLabel"], "aria-label": ariaLabelConfig["controls.zoomOut.ariaLabel"], disabled: minZoomReached, children: (0, import_jsx_runtime3.jsx)(MinusIcon, {}) })] }), showFitView && (0, import_jsx_runtime3.jsx)(ControlButton, { className: "react-flow__controls-fitview", onClick: onFitViewHandler, title: ariaLabelConfig["controls.fitView.ariaLabel"], "aria-label": ariaLabelConfig["controls.fitView.ariaLabel"], children: (0, import_jsx_runtime3.jsx)(FitViewIcon, {}) }), showInteractive && (0, import_jsx_runtime3.jsx)(ControlButton, { className: "react-flow__controls-interactive", onClick: onToggleInteractivity, title: ariaLabelConfig["controls.interactive.ariaLabel"], "aria-label": ariaLabelConfig["controls.interactive.ariaLabel"], children: isInteractive ? (0, import_jsx_runtime3.jsx)(UnlockIcon, {}) : (0, import_jsx_runtime3.jsx)(LockIcon, {}) }), children2] });
}
ControlsComponent.displayName = "Controls";
var Controls = (0, import_react6.memo)(ControlsComponent);
function MiniMapNodeComponent({ id: id2, x, y, width, height, style: style2, color: color2, strokeColor, strokeWidth, className, borderRadius, shapeRendering, selected: selected2, onClick }) {
  const { background, backgroundColor } = style2 || {};
  const fill = color2 || background || backgroundColor;
  return (0, import_jsx_runtime3.jsx)("rect", { className: cc(["react-flow__minimap-node", { selected: selected2 }, className]), x, y, rx: borderRadius, ry: borderRadius, width, height, style: {
    fill,
    stroke: strokeColor,
    strokeWidth
  }, shapeRendering, onClick: onClick ? (event) => onClick(event, id2) : void 0 });
}
var MiniMapNode = (0, import_react6.memo)(MiniMapNodeComponent);
var selectorNodeIds = (s) => s.nodes.map((node) => node.id);
var getAttrFunction = (func) => func instanceof Function ? func : () => func;
function MiniMapNodes({
  nodeStrokeColor,
  nodeColor,
  nodeClassName = "",
  nodeBorderRadius = 5,
  nodeStrokeWidth,
  /*
   * We need to rename the prop to be `CapitalCase` so that JSX will render it as
   * a component properly.
   */
  nodeComponent: NodeComponent = MiniMapNode,
  onClick
}) {
  const nodeIds = useStore(selectorNodeIds, shallow$1);
  const nodeColorFunc = getAttrFunction(nodeColor);
  const nodeStrokeColorFunc = getAttrFunction(nodeStrokeColor);
  const nodeClassNameFunc = getAttrFunction(nodeClassName);
  const shapeRendering = typeof window === "undefined" || !!window.chrome ? "crispEdges" : "geometricPrecision";
  return (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: nodeIds.map((nodeId) => (
    /*
     * The split of responsibilities between MiniMapNodes and
     * NodeComponentWrapper may appear weird. However, it’s designed to
     * minimize the cost of updates when individual nodes change.
     *
     * For more details, see a similar commit in `NodeRenderer/index.tsx`.
     */
    (0, import_jsx_runtime3.jsx)(NodeComponentWrapper, { id: nodeId, nodeColorFunc, nodeStrokeColorFunc, nodeClassNameFunc, nodeBorderRadius, nodeStrokeWidth, NodeComponent, onClick, shapeRendering }, nodeId)
  )) });
}
function NodeComponentWrapperInner({ id: id2, nodeColorFunc, nodeStrokeColorFunc, nodeClassNameFunc, nodeBorderRadius, nodeStrokeWidth, shapeRendering, NodeComponent, onClick }) {
  const { node, x, y, width, height } = useStore((s) => {
    const node2 = s.nodeLookup.get(id2);
    if (!node2) {
      return { node: void 0, x: 0, y: 0, width: 0, height: 0 };
    }
    const userNode = node2.internals.userNode;
    const { x: x2, y: y2 } = node2.internals.positionAbsolute;
    const { width: width2, height: height2 } = getNodeDimensions(userNode);
    return {
      node: userNode,
      x: x2,
      y: y2,
      width: width2,
      height: height2
    };
  }, shallow$1);
  if (!node || node.hidden || !nodeHasDimensions(node)) {
    return null;
  }
  return (0, import_jsx_runtime3.jsx)(NodeComponent, { x, y, width, height, style: node.style, selected: !!node.selected, className: nodeClassNameFunc(node), color: nodeColorFunc(node), borderRadius: nodeBorderRadius, strokeColor: nodeStrokeColorFunc(node), strokeWidth: nodeStrokeWidth, shapeRendering, onClick, id: node.id });
}
var NodeComponentWrapper = (0, import_react6.memo)(NodeComponentWrapperInner);
var MiniMapNodes$1 = (0, import_react6.memo)(MiniMapNodes);
var defaultWidth = 200;
var defaultHeight = 150;
var filterHidden = (node) => !node.hidden;
var selector$1 = (s) => {
  const viewBB = {
    x: -s.transform[0] / s.transform[2],
    y: -s.transform[1] / s.transform[2],
    width: s.width / s.transform[2],
    height: s.height / s.transform[2]
  };
  return {
    viewBB,
    boundingRect: s.nodeLookup.size > 0 ? getBoundsOfRects(getInternalNodesBounds(s.nodeLookup, { filter: filterHidden }), viewBB) : viewBB,
    rfId: s.rfId,
    panZoom: s.panZoom,
    translateExtent: s.translateExtent,
    flowWidth: s.width,
    flowHeight: s.height,
    ariaLabelConfig: s.ariaLabelConfig
  };
};
var ARIA_LABEL_KEY = "react-flow__minimap-desc";
function MiniMapComponent({
  style: style2,
  className,
  nodeStrokeColor,
  nodeColor,
  nodeClassName = "",
  nodeBorderRadius = 5,
  nodeStrokeWidth,
  /*
   * We need to rename the prop to be `CapitalCase` so that JSX will render it as
   * a component properly.
   */
  nodeComponent,
  bgColor,
  maskColor,
  maskStrokeColor,
  maskStrokeWidth,
  position = "bottom-right",
  onClick,
  onNodeClick,
  pannable = false,
  zoomable = false,
  ariaLabel,
  inversePan,
  zoomStep = 1,
  offsetScale = 5
}) {
  const store = useStoreApi();
  const svg = (0, import_react6.useRef)(null);
  const { boundingRect, viewBB, rfId, panZoom, translateExtent, flowWidth, flowHeight, ariaLabelConfig } = useStore(selector$1, shallow$1);
  const elementWidth = style2?.width ?? defaultWidth;
  const elementHeight = style2?.height ?? defaultHeight;
  const scaledWidth = boundingRect.width / elementWidth;
  const scaledHeight = boundingRect.height / elementHeight;
  const viewScale = Math.max(scaledWidth, scaledHeight);
  const viewWidth = viewScale * elementWidth;
  const viewHeight = viewScale * elementHeight;
  const offset = offsetScale * viewScale;
  const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset;
  const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset;
  const width = viewWidth + offset * 2;
  const height = viewHeight + offset * 2;
  const labelledBy = `${ARIA_LABEL_KEY}-${rfId}`;
  const viewScaleRef = (0, import_react6.useRef)(0);
  const minimapInstance = (0, import_react6.useRef)();
  viewScaleRef.current = viewScale;
  (0, import_react6.useEffect)(() => {
    if (svg.current && panZoom) {
      minimapInstance.current = XYMinimap({
        domNode: svg.current,
        panZoom,
        getTransform: () => store.getState().transform,
        getViewScale: () => viewScaleRef.current
      });
      return () => {
        minimapInstance.current?.destroy();
      };
    }
  }, [panZoom]);
  (0, import_react6.useEffect)(() => {
    minimapInstance.current?.update({
      translateExtent,
      width: flowWidth,
      height: flowHeight,
      inversePan,
      pannable,
      zoomStep,
      zoomable
    });
  }, [pannable, zoomable, inversePan, zoomStep, translateExtent, flowWidth, flowHeight]);
  const onSvgClick = onClick ? (event) => {
    const [x2, y2] = minimapInstance.current?.pointer(event) || [0, 0];
    onClick(event, { x: x2, y: y2 });
  } : void 0;
  const onSvgNodeClick = onNodeClick ? (0, import_react6.useCallback)((event, nodeId) => {
    const node = store.getState().nodeLookup.get(nodeId).internals.userNode;
    onNodeClick(event, node);
  }, []) : void 0;
  const _ariaLabel = ariaLabel ?? ariaLabelConfig["minimap.ariaLabel"];
  return (0, import_jsx_runtime3.jsx)(Panel, { position, style: {
    ...style2,
    "--xy-minimap-background-color-props": typeof bgColor === "string" ? bgColor : void 0,
    "--xy-minimap-mask-background-color-props": typeof maskColor === "string" ? maskColor : void 0,
    "--xy-minimap-mask-stroke-color-props": typeof maskStrokeColor === "string" ? maskStrokeColor : void 0,
    "--xy-minimap-mask-stroke-width-props": typeof maskStrokeWidth === "number" ? maskStrokeWidth * viewScale : void 0,
    "--xy-minimap-node-background-color-props": typeof nodeColor === "string" ? nodeColor : void 0,
    "--xy-minimap-node-stroke-color-props": typeof nodeStrokeColor === "string" ? nodeStrokeColor : void 0,
    "--xy-minimap-node-stroke-width-props": typeof nodeStrokeWidth === "number" ? nodeStrokeWidth : void 0
  }, className: cc(["react-flow__minimap", className]), "data-testid": "rf__minimap", children: (0, import_jsx_runtime3.jsxs)("svg", { width: elementWidth, height: elementHeight, viewBox: `${x} ${y} ${width} ${height}`, className: "react-flow__minimap-svg", role: "img", "aria-labelledby": labelledBy, ref: svg, onClick: onSvgClick, children: [_ariaLabel && (0, import_jsx_runtime3.jsx)("title", { id: labelledBy, children: _ariaLabel }), (0, import_jsx_runtime3.jsx)(MiniMapNodes$1, { onClick: onSvgNodeClick, nodeColor, nodeStrokeColor, nodeBorderRadius, nodeClassName, nodeStrokeWidth, nodeComponent }), (0, import_jsx_runtime3.jsx)("path", { className: "react-flow__minimap-mask", d: `M${x - offset},${y - offset}h${width + offset * 2}v${height + offset * 2}h${-width - offset * 2}z
        M${viewBB.x},${viewBB.y}h${viewBB.width}v${viewBB.height}h${-viewBB.width}z`, fillRule: "evenodd", pointerEvents: "none" })] }) });
}
MiniMapComponent.displayName = "MiniMap";
var MiniMap = (0, import_react6.memo)(MiniMapComponent);
var scaleSelector = (calculateScale) => (store) => calculateScale ? `${Math.max(1 / store.transform[2], 1)}` : void 0;
var defaultPositions = {
  [ResizeControlVariant.Line]: "right",
  [ResizeControlVariant.Handle]: "bottom-right"
};
function ResizeControl({ nodeId, position, variant = ResizeControlVariant.Handle, className, style: style2 = void 0, children: children2, color: color2, minWidth = 10, minHeight = 10, maxWidth = Number.MAX_VALUE, maxHeight = Number.MAX_VALUE, keepAspectRatio = false, resizeDirection, autoScale = true, shouldResize, onResizeStart, onResize, onResizeEnd }) {
  const contextNodeId = useNodeId();
  const id2 = typeof nodeId === "string" ? nodeId : contextNodeId;
  const store = useStoreApi();
  const resizeControlRef = (0, import_react6.useRef)(null);
  const isHandleControl = variant === ResizeControlVariant.Handle;
  const scale = useStore((0, import_react6.useCallback)(scaleSelector(isHandleControl && autoScale), [isHandleControl, autoScale]), shallow$1);
  const resizer = (0, import_react6.useRef)(null);
  const controlPosition = position ?? defaultPositions[variant];
  (0, import_react6.useEffect)(() => {
    if (!resizeControlRef.current || !id2) {
      return;
    }
    if (!resizer.current) {
      resizer.current = XYResizer({
        domNode: resizeControlRef.current,
        nodeId: id2,
        getStoreItems: () => {
          const { nodeLookup, transform: transform2, snapGrid, snapToGrid, nodeOrigin, domNode } = store.getState();
          return {
            nodeLookup,
            transform: transform2,
            snapGrid,
            snapToGrid,
            nodeOrigin,
            paneDomNode: domNode
          };
        },
        onChange: (change, childChanges) => {
          const { triggerNodeChanges, nodeLookup, parentLookup, nodeOrigin } = store.getState();
          const changes = [];
          const nextPosition = { x: change.x, y: change.y };
          const node = nodeLookup.get(id2);
          if (node && node.expandParent && node.parentId) {
            const origin = node.origin ?? nodeOrigin;
            const width = change.width ?? node.measured.width ?? 0;
            const height = change.height ?? node.measured.height ?? 0;
            const child = {
              id: node.id,
              parentId: node.parentId,
              rect: {
                width,
                height,
                ...evaluateAbsolutePosition({
                  x: change.x ?? node.position.x,
                  y: change.y ?? node.position.y
                }, { width, height }, node.parentId, nodeLookup, origin)
              }
            };
            const parentExpandChanges = handleExpandParent([child], nodeLookup, parentLookup, nodeOrigin);
            changes.push(...parentExpandChanges);
            nextPosition.x = change.x ? Math.max(origin[0] * width, change.x) : void 0;
            nextPosition.y = change.y ? Math.max(origin[1] * height, change.y) : void 0;
          }
          if (nextPosition.x !== void 0 && nextPosition.y !== void 0) {
            const positionChange = {
              id: id2,
              type: "position",
              position: { ...nextPosition }
            };
            changes.push(positionChange);
          }
          if (change.width !== void 0 && change.height !== void 0) {
            const setAttributes = !resizeDirection ? true : resizeDirection === "horizontal" ? "width" : "height";
            const dimensionChange = {
              id: id2,
              type: "dimensions",
              resizing: true,
              setAttributes,
              dimensions: {
                width: change.width,
                height: change.height
              }
            };
            changes.push(dimensionChange);
          }
          for (const childChange of childChanges) {
            const positionChange = {
              ...childChange,
              type: "position"
            };
            changes.push(positionChange);
          }
          triggerNodeChanges(changes);
        },
        onEnd: ({ width, height }) => {
          const dimensionChange = {
            id: id2,
            type: "dimensions",
            resizing: false,
            dimensions: {
              width,
              height
            }
          };
          store.getState().triggerNodeChanges([dimensionChange]);
        }
      });
    }
    resizer.current.update({
      controlPosition,
      boundaries: {
        minWidth,
        minHeight,
        maxWidth,
        maxHeight
      },
      keepAspectRatio,
      resizeDirection,
      onResizeStart,
      onResize,
      onResizeEnd,
      shouldResize
    });
    return () => {
      resizer.current?.destroy();
    };
  }, [
    controlPosition,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    keepAspectRatio,
    onResizeStart,
    onResize,
    onResizeEnd,
    shouldResize
  ]);
  const positionClassNames = controlPosition.split("-");
  return (0, import_jsx_runtime3.jsx)("div", { className: cc(["react-flow__resize-control", "nodrag", ...positionClassNames, variant, className]), ref: resizeControlRef, style: {
    ...style2,
    scale,
    ...color2 && { [isHandleControl ? "backgroundColor" : "borderColor"]: color2 }
  }, children: children2 });
}
var NodeResizeControl = (0, import_react6.memo)(ResizeControl);

// node_modules/@xyflow/react/dist/style.css
var style_default3 = "/* this gets exported as style.css and can be used for the default theming */\n/* these are the necessary styles for React/Svelte Flow, they get used by base.css and style.css */\n.react-flow {\n  direction: ltr;\n\n  --xy-edge-stroke-default: #b1b1b7;\n  --xy-edge-stroke-width-default: 1;\n  --xy-edge-stroke-selected-default: #555;\n\n  --xy-connectionline-stroke-default: #b1b1b7;\n  --xy-connectionline-stroke-width-default: 1;\n\n  --xy-attribution-background-color-default: rgba(255, 255, 255, 0.5);\n\n  --xy-minimap-background-color-default: #fff;\n  --xy-minimap-mask-background-color-default: rgba(240, 240, 240, 0.6);\n  --xy-minimap-mask-stroke-color-default: transparent;\n  --xy-minimap-mask-stroke-width-default: 1;\n  --xy-minimap-node-background-color-default: #e2e2e2;\n  --xy-minimap-node-stroke-color-default: transparent;\n  --xy-minimap-node-stroke-width-default: 2;\n\n  --xy-background-color-default: transparent;\n  --xy-background-pattern-dots-color-default: #91919a;\n  --xy-background-pattern-lines-color-default: #eee;\n  --xy-background-pattern-cross-color-default: #e2e2e2;\n  background-color: var(--xy-background-color, var(--xy-background-color-default));\n  --xy-node-color-default: inherit;\n  --xy-node-border-default: 1px solid #1a192b;\n  --xy-node-background-color-default: #fff;\n  --xy-node-group-background-color-default: rgba(240, 240, 240, 0.25);\n  --xy-node-boxshadow-hover-default: 0 1px 4px 1px rgba(0, 0, 0, 0.08);\n  --xy-node-boxshadow-selected-default: 0 0 0 0.5px #1a192b;\n  --xy-node-border-radius-default: 3px;\n\n  --xy-handle-background-color-default: #1a192b;\n  --xy-handle-border-color-default: #fff;\n\n  --xy-selection-background-color-default: rgba(0, 89, 220, 0.08);\n  --xy-selection-border-default: 1px dotted rgba(0, 89, 220, 0.8);\n\n  --xy-controls-button-background-color-default: #fefefe;\n  --xy-controls-button-background-color-hover-default: #f4f4f4;\n  --xy-controls-button-color-default: inherit;\n  --xy-controls-button-color-hover-default: inherit;\n  --xy-controls-button-border-color-default: #eee;\n  --xy-controls-box-shadow-default: 0 0 2px 1px rgba(0, 0, 0, 0.08);\n\n  --xy-edge-label-background-color-default: #ffffff;\n  --xy-edge-label-color-default: inherit;\n  --xy-resize-background-color-default: #3367d9;\n}\n.react-flow.dark {\n  --xy-edge-stroke-default: #3e3e3e;\n  --xy-edge-stroke-width-default: 1;\n  --xy-edge-stroke-selected-default: #727272;\n\n  --xy-connectionline-stroke-default: #b1b1b7;\n  --xy-connectionline-stroke-width-default: 1;\n\n  --xy-attribution-background-color-default: rgba(150, 150, 150, 0.25);\n\n  --xy-minimap-background-color-default: #141414;\n  --xy-minimap-mask-background-color-default: rgba(60, 60, 60, 0.6);\n  --xy-minimap-mask-stroke-color-default: transparent;\n  --xy-minimap-mask-stroke-width-default: 1;\n  --xy-minimap-node-background-color-default: #2b2b2b;\n  --xy-minimap-node-stroke-color-default: transparent;\n  --xy-minimap-node-stroke-width-default: 2;\n\n  --xy-background-color-default: #141414;\n  --xy-background-pattern-dots-color-default: #777;\n  --xy-background-pattern-lines-color-default: #777;\n  --xy-background-pattern-cross-color-default: #777;\n  --xy-node-color-default: #f8f8f8;\n  --xy-node-border-default: 1px solid #3c3c3c;\n  --xy-node-background-color-default: #1e1e1e;\n  --xy-node-group-background-color-default: rgba(240, 240, 240, 0.25);\n  --xy-node-boxshadow-hover-default: 0 1px 4px 1px rgba(255, 255, 255, 0.08);\n  --xy-node-boxshadow-selected-default: 0 0 0 0.5px #999;\n\n  --xy-handle-background-color-default: #bebebe;\n  --xy-handle-border-color-default: #1e1e1e;\n\n  --xy-selection-background-color-default: rgba(200, 200, 220, 0.08);\n  --xy-selection-border-default: 1px dotted rgba(200, 200, 220, 0.8);\n\n  --xy-controls-button-background-color-default: #2b2b2b;\n  --xy-controls-button-background-color-hover-default: #3e3e3e;\n  --xy-controls-button-color-default: #f8f8f8;\n  --xy-controls-button-color-hover-default: #fff;\n  --xy-controls-button-border-color-default: #5b5b5b;\n  --xy-controls-box-shadow-default: 0 0 2px 1px rgba(0, 0, 0, 0.08);\n\n  --xy-edge-label-background-color-default: #141414;\n  --xy-edge-label-color-default: #f8f8f8;\n}\n.react-flow__background {\n  background-color: var(--xy-background-color-props, var(--xy-background-color, var(--xy-background-color-default)));\n  pointer-events: none;\n  z-index: -1;\n}\n.react-flow__container {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n}\n.react-flow__pane {\n  z-index: 1;\n}\n.react-flow__pane.draggable {\n    cursor: grab;\n  }\n.react-flow__pane.dragging {\n    cursor: grabbing;\n  }\n.react-flow__pane.selection {\n    cursor: pointer;\n  }\n.react-flow__viewport {\n  transform-origin: 0 0;\n  z-index: 2;\n  pointer-events: none;\n}\n.react-flow__renderer {\n  z-index: 4;\n}\n.react-flow__selection {\n  z-index: 6;\n}\n.react-flow__nodesselection-rect:focus,\n.react-flow__nodesselection-rect:focus-visible {\n  outline: none;\n}\n.react-flow__edge-path {\n  stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n  stroke-width: var(--xy-edge-stroke-width, var(--xy-edge-stroke-width-default));\n  fill: none;\n}\n.react-flow__connection-path {\n  stroke: var(--xy-connectionline-stroke, var(--xy-connectionline-stroke-default));\n  stroke-width: var(--xy-connectionline-stroke-width, var(--xy-connectionline-stroke-width-default));\n  fill: none;\n}\n.react-flow .react-flow__edges {\n  position: absolute;\n}\n.react-flow .react-flow__edges svg {\n    overflow: visible;\n    position: absolute;\n    pointer-events: none;\n  }\n.react-flow__edge {\n  pointer-events: visibleStroke;\n}\n.react-flow__edge.selectable {\n    cursor: pointer;\n  }\n.react-flow__edge.animated path {\n    stroke-dasharray: 5;\n    animation: dashdraw 0.5s linear infinite;\n  }\n.react-flow__edge.animated path.react-flow__edge-interaction {\n    stroke-dasharray: none;\n    animation: none;\n  }\n.react-flow__edge.inactive {\n    pointer-events: none;\n  }\n.react-flow__edge.selected,\n  .react-flow__edge:focus,\n  .react-flow__edge:focus-visible {\n    outline: none;\n  }\n.react-flow__edge.selected .react-flow__edge-path,\n  .react-flow__edge.selectable:focus .react-flow__edge-path,\n  .react-flow__edge.selectable:focus-visible .react-flow__edge-path {\n    stroke: var(--xy-edge-stroke-selected, var(--xy-edge-stroke-selected-default));\n  }\n.react-flow__edge-textwrapper {\n    pointer-events: all;\n  }\n.react-flow__edge .react-flow__edge-text {\n    pointer-events: none;\n    -webkit-user-select: none;\n       -moz-user-select: none;\n            user-select: none;\n  }\n/* Arrowhead marker styles - use CSS custom properties as default */\n.react-flow__arrowhead polyline {\n  stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n}\n.react-flow__arrowhead polyline.arrowclosed {\n  fill: var(--xy-edge-stroke, var(--xy-edge-stroke-default));\n}\n.react-flow__connection {\n  pointer-events: none;\n}\n.react-flow__connection .animated {\n    stroke-dasharray: 5;\n    animation: dashdraw 0.5s linear infinite;\n  }\nsvg.react-flow__connectionline {\n  z-index: 1001;\n  overflow: visible;\n  position: absolute;\n}\n.react-flow__nodes {\n  pointer-events: none;\n  transform-origin: 0 0;\n}\n.react-flow__node {\n  position: absolute;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  pointer-events: all;\n  transform-origin: 0 0;\n  box-sizing: border-box;\n  cursor: default;\n}\n.react-flow__node.selectable {\n    cursor: pointer;\n  }\n.react-flow__node.draggable {\n    cursor: grab;\n    pointer-events: all;\n  }\n.react-flow__node.draggable.dragging {\n      cursor: grabbing;\n    }\n.react-flow__nodesselection {\n  z-index: 3;\n  transform-origin: left top;\n  pointer-events: none;\n}\n.react-flow__nodesselection-rect {\n    position: absolute;\n    pointer-events: all;\n    cursor: grab;\n  }\n.react-flow__handle {\n  position: absolute;\n  pointer-events: none;\n  min-width: 5px;\n  min-height: 5px;\n  width: 6px;\n  height: 6px;\n  background-color: var(--xy-handle-background-color, var(--xy-handle-background-color-default));\n  border: 1px solid var(--xy-handle-border-color, var(--xy-handle-border-color-default));\n  border-radius: 100%;\n}\n.react-flow__handle.connectingfrom {\n    pointer-events: all;\n  }\n.react-flow__handle.connectionindicator {\n    pointer-events: all;\n    cursor: crosshair;\n  }\n.react-flow__handle-bottom {\n    top: auto;\n    left: 50%;\n    bottom: 0;\n    transform: translate(-50%, 50%);\n  }\n.react-flow__handle-top {\n    top: 0;\n    left: 50%;\n    transform: translate(-50%, -50%);\n  }\n.react-flow__handle-left {\n    top: 50%;\n    left: 0;\n    transform: translate(-50%, -50%);\n  }\n.react-flow__handle-right {\n    top: 50%;\n    right: 0;\n    transform: translate(50%, -50%);\n  }\n.react-flow__edgeupdater {\n  cursor: move;\n  pointer-events: all;\n}\n.react-flow__pane.selection .react-flow__panel {\n  pointer-events: none;\n}\n.react-flow__panel {\n  position: absolute;\n  z-index: 5;\n  margin: 15px;\n}\n.react-flow__panel.top {\n    top: 0;\n  }\n.react-flow__panel.bottom {\n    bottom: 0;\n  }\n.react-flow__panel.top.center, .react-flow__panel.bottom.center {\n      left: 50%;\n      transform: translateX(-15px) translateX(-50%);\n    }\n.react-flow__panel.left {\n    left: 0;\n  }\n.react-flow__panel.right {\n    right: 0;\n  }\n.react-flow__panel.left.center, .react-flow__panel.right.center {\n      top: 50%;\n      transform: translateY(-15px) translateY(-50%);\n    }\n.react-flow__attribution {\n  font-size: 10px;\n  background: var(--xy-attribution-background-color, var(--xy-attribution-background-color-default));\n  padding: 2px 3px;\n  margin: 0;\n}\n.react-flow__attribution a {\n    text-decoration: none;\n    color: #999;\n  }\n@keyframes dashdraw {\n  from {\n    stroke-dashoffset: 10;\n  }\n}\n.react-flow__edgelabel-renderer {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  left: 0;\n  top: 0;\n}\n.react-flow__viewport-portal {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  left: 0;\n  top: 0;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n}\n.react-flow__minimap {\n  background: var(\n    --xy-minimap-background-color-props,\n    var(--xy-minimap-background-color, var(--xy-minimap-background-color-default))\n  );\n}\n.react-flow__minimap-svg {\n    display: block;\n  }\n.react-flow__minimap-mask {\n    fill: var(\n      --xy-minimap-mask-background-color-props,\n      var(--xy-minimap-mask-background-color, var(--xy-minimap-mask-background-color-default))\n    );\n    stroke: var(\n      --xy-minimap-mask-stroke-color-props,\n      var(--xy-minimap-mask-stroke-color, var(--xy-minimap-mask-stroke-color-default))\n    );\n    stroke-width: var(\n      --xy-minimap-mask-stroke-width-props,\n      var(--xy-minimap-mask-stroke-width, var(--xy-minimap-mask-stroke-width-default))\n    );\n  }\n.react-flow__minimap-node {\n    fill: var(\n      --xy-minimap-node-background-color-props,\n      var(--xy-minimap-node-background-color, var(--xy-minimap-node-background-color-default))\n    );\n    stroke: var(\n      --xy-minimap-node-stroke-color-props,\n      var(--xy-minimap-node-stroke-color, var(--xy-minimap-node-stroke-color-default))\n    );\n    stroke-width: var(\n      --xy-minimap-node-stroke-width-props,\n      var(--xy-minimap-node-stroke-width, var(--xy-minimap-node-stroke-width-default))\n    );\n  }\n.react-flow__background-pattern.dots {\n    fill: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-dots-color-default))\n    );\n  }\n.react-flow__background-pattern.lines {\n    stroke: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-lines-color-default))\n    );\n  }\n.react-flow__background-pattern.cross {\n    stroke: var(\n      --xy-background-pattern-color-props,\n      var(--xy-background-pattern-color, var(--xy-background-pattern-cross-color-default))\n    );\n  }\n.react-flow__controls {\n  display: flex;\n  flex-direction: column;\n  box-shadow: var(--xy-controls-box-shadow, var(--xy-controls-box-shadow-default));\n}\n.react-flow__controls.horizontal {\n    flex-direction: row;\n  }\n.react-flow__controls-button {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    height: 26px;\n    width: 26px;\n    padding: 4px;\n    border: none;\n    background: var(--xy-controls-button-background-color, var(--xy-controls-button-background-color-default));\n    border-bottom: 1px solid\n      var(\n        --xy-controls-button-border-color-props,\n        var(--xy-controls-button-border-color, var(--xy-controls-button-border-color-default))\n      );\n    color: var(\n      --xy-controls-button-color-props,\n      var(--xy-controls-button-color, var(--xy-controls-button-color-default))\n    );\n    cursor: pointer;\n    -webkit-user-select: none;\n       -moz-user-select: none;\n            user-select: none;\n  }\n.react-flow__controls-button svg {\n      width: 100%;\n      max-width: 12px;\n      max-height: 12px;\n      fill: currentColor;\n    }\n.react-flow__edge.updating .react-flow__edge-path {\n      stroke: #777;\n    }\n.react-flow__edge-text {\n    font-size: 10px;\n  }\n.react-flow__node.selectable:focus,\n  .react-flow__node.selectable:focus-visible {\n    outline: none;\n  }\n.react-flow__node-input,\n.react-flow__node-default,\n.react-flow__node-output,\n.react-flow__node-group {\n  padding: 10px;\n  border-radius: var(--xy-node-border-radius, var(--xy-node-border-radius-default));\n  width: 150px;\n  font-size: 12px;\n  color: var(--xy-node-color, var(--xy-node-color-default));\n  text-align: center;\n  border: var(--xy-node-border, var(--xy-node-border-default));\n  background-color: var(--xy-node-background-color, var(--xy-node-background-color-default));\n}\n.react-flow__node-input.selectable:hover, .react-flow__node-default.selectable:hover, .react-flow__node-output.selectable:hover, .react-flow__node-group.selectable:hover {\n      box-shadow: var(--xy-node-boxshadow-hover, var(--xy-node-boxshadow-hover-default));\n    }\n.react-flow__node-input.selectable.selected,\n    .react-flow__node-input.selectable:focus,\n    .react-flow__node-input.selectable:focus-visible,\n    .react-flow__node-default.selectable.selected,\n    .react-flow__node-default.selectable:focus,\n    .react-flow__node-default.selectable:focus-visible,\n    .react-flow__node-output.selectable.selected,\n    .react-flow__node-output.selectable:focus,\n    .react-flow__node-output.selectable:focus-visible,\n    .react-flow__node-group.selectable.selected,\n    .react-flow__node-group.selectable:focus,\n    .react-flow__node-group.selectable:focus-visible {\n      box-shadow: var(--xy-node-boxshadow-selected, var(--xy-node-boxshadow-selected-default));\n    }\n.react-flow__node-group {\n  background-color: var(--xy-node-group-background-color, var(--xy-node-group-background-color-default));\n}\n.react-flow__nodesselection-rect,\n.react-flow__selection {\n  background: var(--xy-selection-background-color, var(--xy-selection-background-color-default));\n  border: var(--xy-selection-border, var(--xy-selection-border-default));\n}\n.react-flow__nodesselection-rect:focus,\n  .react-flow__nodesselection-rect:focus-visible,\n  .react-flow__selection:focus,\n  .react-flow__selection:focus-visible {\n    outline: none;\n  }\n.react-flow__controls-button:hover {\n      background: var(\n        --xy-controls-button-background-color-hover-props,\n        var(--xy-controls-button-background-color-hover, var(--xy-controls-button-background-color-hover-default))\n      );\n      color: var(\n        --xy-controls-button-color-hover-props,\n        var(--xy-controls-button-color-hover, var(--xy-controls-button-color-hover-default))\n      );\n    }\n.react-flow__controls-button:disabled {\n      pointer-events: none;\n    }\n.react-flow__controls-button:disabled svg {\n        fill-opacity: 0.4;\n      }\n.react-flow__controls-button:last-child {\n    border-bottom: none;\n  }\n.react-flow__controls.horizontal .react-flow__controls-button {\n    border-bottom: none;\n    border-right: 1px solid\n      var(\n        --xy-controls-button-border-color-props,\n        var(--xy-controls-button-border-color, var(--xy-controls-button-border-color-default))\n      );\n  }\n.react-flow__controls.horizontal .react-flow__controls-button:last-child {\n    border-right: none;\n  }\n.react-flow__resize-control {\n  position: absolute;\n}\n.react-flow__resize-control.left,\n.react-flow__resize-control.right {\n  cursor: ew-resize;\n}\n.react-flow__resize-control.top,\n.react-flow__resize-control.bottom {\n  cursor: ns-resize;\n}\n.react-flow__resize-control.top.left,\n.react-flow__resize-control.bottom.right {\n  cursor: nwse-resize;\n}\n.react-flow__resize-control.bottom.left,\n.react-flow__resize-control.top.right {\n  cursor: nesw-resize;\n}\n/* handle styles */\n.react-flow__resize-control.handle {\n  width: 5px;\n  height: 5px;\n  border: 1px solid #fff;\n  border-radius: 1px;\n  background-color: var(--xy-resize-background-color, var(--xy-resize-background-color-default));\n  translate: -50% -50%;\n}\n.react-flow__resize-control.handle.left {\n  left: 0;\n  top: 50%;\n}\n.react-flow__resize-control.handle.right {\n  left: 100%;\n  top: 50%;\n}\n.react-flow__resize-control.handle.top {\n  left: 50%;\n  top: 0;\n}\n.react-flow__resize-control.handle.bottom {\n  left: 50%;\n  top: 100%;\n}\n.react-flow__resize-control.handle.top.left {\n  left: 0;\n}\n.react-flow__resize-control.handle.bottom.left {\n  left: 0;\n}\n.react-flow__resize-control.handle.top.right {\n  left: 100%;\n}\n.react-flow__resize-control.handle.bottom.right {\n  left: 100%;\n}\n/* line styles */\n.react-flow__resize-control.line {\n  border-color: var(--xy-resize-background-color, var(--xy-resize-background-color-default));\n  border-width: 0;\n  border-style: solid;\n}\n.react-flow__resize-control.line.left,\n.react-flow__resize-control.line.right {\n  width: 1px;\n  transform: translate(-50%, 0);\n  top: 0;\n  height: 100%;\n}\n.react-flow__resize-control.line.left {\n  left: 0;\n  border-left-width: 1px;\n}\n.react-flow__resize-control.line.right {\n  left: 100%;\n  border-right-width: 1px;\n}\n.react-flow__resize-control.line.top,\n.react-flow__resize-control.line.bottom {\n  height: 1px;\n  transform: translate(0, -50%);\n  left: 0;\n  width: 100%;\n}\n.react-flow__resize-control.line.top {\n  top: 0;\n  border-top-width: 1px;\n}\n.react-flow__resize-control.line.bottom {\n  border-bottom-width: 1px;\n  top: 100%;\n}\n.react-flow__edge-textbg {\n  fill: var(--xy-edge-label-background-color, var(--xy-edge-label-background-color-default));\n}\n.react-flow__edge-text {\n  fill: var(--xy-edge-label-color, var(--xy-edge-label-color-default));\n}\n";

// client/style.css
var style_default4 = '/* Workflow Studio surfaces.\n   Visual model: a light canvas with tinted step cards, a floating step toolbar,\n   a right-hand Step inspector, expressed with Harness theme aliases. */\n\n.wf {\n  --wf-bg: var(--dsw-alias-bg-base, #fff);\n  --wf-surface: var(--dsw-alias-bg-base, #fff);\n  --wf-surface-subtle: var(--dsw-alias-bg-secondary, #f6f7f9);\n  --wf-surface-strong: var(--dsw-alias-interactive-bg-hover, #eef0f3);\n  --wf-text: var(--dsw-alias-label-primary, #202428);\n  --wf-muted: var(--dsw-alias-label-secondary, #6c747c);\n  --wf-line: var(--dsw-alias-border-l3, #e4e7ea);\n  --wf-line-strong: var(--dsw-alias-border-l2, #cfd5db);\n  --wf-hover: var(--dsw-alias-interactive-bg-hover, #f1f3f5);\n  --wf-accent: var(--dsw-alias-brand-primary, #6a5acd);\n  --wf-accent-soft: color-mix(in srgb, var(--wf-accent) 14%, transparent);\n  --wf-radius: 14px;\n  --wf-shadow: 0 1px 2px rgb(16 24 40 / 6%), 0 8px 24px rgb(16 24 40 / 6%);\n  color: var(--wf-text);\n  font: 13px/1.5 var(--dsw-font-family, system-ui, sans-serif);\n  letter-spacing: 0;\n}\n.wf * {\n  box-sizing: border-box;\n  letter-spacing: 0;\n}\n.wf button:where(:not(.wf-native-step *)),\n.wf input:where(:not(.wf-native-step *)),\n.wf select:where(:not(.wf-native-step *)),\n.wf textarea:where(:not(.wf-native-step *)) {\n  font: inherit;\n  color: inherit;\n}\n.wf button:where(:not(.wf-native-step *)) {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  min-height: 30px;\n  padding: 5px 10px;\n  border: 1px solid var(--wf-line);\n  border-radius: 8px;\n  background: var(--wf-surface);\n  cursor: pointer;\n  transition: background .15s ease, border-color .15s ease, color .15s ease;\n}\n.wf button:where(:not(.wf-native-step *)):hover {\n  background: var(--wf-surface-strong);\n  border-color: var(--wf-line-strong);\n}\n.wf button:where(:not(.wf-native-step *)):disabled {\n  opacity: .45;\n  cursor: default;\n}\n.wf button:where(:not(.wf-native-step *)):focus-visible,\n.wf input:where(:not(.wf-native-step *)):focus-visible,\n.wf select:where(:not(.wf-native-step *)):focus-visible,\n.wf textarea:where(:not(.wf-native-step *)):focus-visible,\n.wf [contenteditable]:focus-visible {\n  outline: 2px solid var(--wf-accent);\n  outline-offset: 1px;\n}\n.wf input:where(:not(.wf-native-step *)):not([type="checkbox"]),\n.wf select:where(:not(.wf-native-step *)),\n.wf textarea:where(:not(.wf-native-step *)) {\n  width: 100%;\n  min-width: 0;\n  padding: 7px 9px;\n  border: 1px solid var(--wf-line);\n  border-radius: 8px;\n  background: var(--wf-surface);\n}\n.wf textarea:where(:not(.wf-native-step *)) {\n  resize: vertical;\n  background: var(--wf-surface-subtle);\n  font: 12px/1.6 ui-monospace, monospace;\n}\n.wf h1:where(:not(.wf-native-step *)) { margin: 0; font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }\n.wf h2:where(:not(.wf-native-step *)) { margin: 0; font-size: 16px; }\n.wf h3:where(:not(.wf-native-step *)) { margin: 0; font-size: 13px; font-weight: 600; }\n.wf .wf-primary {\n  background: var(--wf-accent);\n  border-color: var(--wf-accent);\n  color: #fff;\n  box-shadow: 0 1px 1px rgb(16 24 40 / 10%);\n}\n.wf .wf-primary:hover { background: color-mix(in srgb, var(--wf-accent) 86%, #000); border-color: transparent; }\n.wf .wf-icon {\n  width: 28px;\n  height: 28px;\n  min-height: 28px;\n  flex: 0 0 28px;\n  padding: 5px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--wf-muted);\n}\n.wf .wf-icon:hover { background: var(--wf-surface-strong); color: var(--wf-text); }\n.wf-spacer { flex: 1; }\n.wf-muted,\n.wf small:where(:not(.wf-native-step *)) { color: var(--wf-muted); }\n.wf small:where(:not(.wf-native-step *)) { display: block; font-size: 11px; }\n.wf-error { color: var(--dsw-alias-state-error-primary, #b13e4a); overflow-wrap: anywhere; }\n.wf [role="alert"] { overflow-wrap: anywhere; }\n\n/* ---------------------------------------------------------------- shell */\n.wf-workspace-wrapper {\n  display: flex;\n  flex: 1;\n  min-height: 0;\n  flex-direction: column;\n  overflow: hidden;\n}\n.wf-main {\n  height: 100%;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  background: var(--wf-bg);\n  overflow: hidden;\n}\n.wf-main, .wf-editor, .wf-editor-body { min-width: 0; max-width: 100%; }\n\n/* ------------------------------------------------------------ app bar */\n.wf-appbar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 56px;\n  padding: 10px 16px;\n  border-bottom: 1px solid var(--wf-line);\n  background: var(--wf-surface);\n  flex: none;\n}\n.wf-appbar > svg { flex: none; color: var(--wf-muted); }\n.wf-appbar-name {\n  width: auto !important;\n  max-width: 260px;\n  min-width: 90px;\n  padding: 5px 6px !important;\n  border: 1px solid transparent !important;\n  border-radius: 8px !important;\n  background: transparent !important;\n  font-size: 15px !important;\n  font-weight: 600 !important;\n}\n.wf-appbar-name:hover { border-color: var(--wf-line) !important; }\n.wf-appbar-name:disabled { color: var(--wf-text); opacity: 1; }\n.wf-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  height: 24px;\n  padding: 0 9px;\n  border-radius: 999px;\n  background: var(--wf-surface-strong);\n  color: var(--wf-muted);\n  font-size: 11px;\n  font-weight: 600;\n  white-space: nowrap;\n}\n/* The host\'s state tokens are a solid accent plus a surface tint, not a text color:\n   the tint is the theme-correct background for a small chip, and the accent carries\n   the state as a dot. The label itself uses the reading color, so it stays legible in\n   either theme instead of tracking a tint that is pale in one and dark in the other. */\n.wf-chip.is-published { background: var(--dsw-alias-state-success-tertiary, #e3f5ea); color: var(--wf-text); }\n.wf-chip.is-published::before,\n.wf-chip.is-dirty::before {\n  content: "";\n  width: 6px;\n  height: 6px;\n  flex: none;\n  border-radius: 50%;\n  background: currentColor;\n}\n.wf-chip.is-published::before { background: var(--dsw-alias-state-success-primary, #2f9e6b); }\n.wf-chip.is-dirty { background: var(--dsw-alias-state-warn-tertiary, #f8ecdc); color: var(--wf-text); }\n.wf-chip.is-dirty::before { background: var(--dsw-alias-state-warn-primary, #d98324); }\n.wf-segmented {\n  display: inline-flex;\n  gap: 2px;\n  padding: 2px;\n  border-radius: 999px;\n  background: var(--wf-surface-strong);\n}\n.wf-segmented button {\n  min-height: 32px;\n  padding: 5px 14px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: var(--wf-muted);\n  font-size: 12px;\n  font-weight: 600;\n}\n.wf-segmented button[aria-selected="true"] {\n  background: var(--wf-surface);\n  color: var(--wf-text);\n  box-shadow: 0 1px 2px rgb(16 24 40 / 12%);\n}\n.wf-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 0 0 10px;\n}\n.wf-toolbar h3 { margin: 0; }\n.wf-tabs {\n  display: flex;\n  gap: 20px;\n  padding: 0 16px;\n  border-bottom: 1px solid var(--wf-line);\n  background: var(--wf-surface);\n  flex: none;\n}\n.wf-tabs button {\n  padding: 10px 0;\n  border: 0;\n  border-bottom: 2px solid transparent;\n  border-radius: 0;\n  background: none;\n  color: var(--wf-muted);\n  font-size: 13px;\n}\n.wf-tabs button[aria-current] { border-bottom-color: var(--wf-accent); color: var(--wf-accent); font-weight: 600; }\n.wf-scroll { flex: 1; min-height: 0; padding: 16px 18px; overflow: auto; }\n.wf table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }\n.wf th { color: var(--wf-muted); font-size: 11px; font-weight: 600; }\n.wf th, .wf td { padding: 12px 10px; border-bottom: 1px solid var(--wf-line); vertical-align: middle; }\n.wf td:first-child { padding-left: 0; }\n.wf .wf-link { padding: 0; border: 0; background: none; font-weight: 600; }\n.wf-import {\n  position: relative;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 30px;\n  height: 30px;\n  border: 1px solid var(--wf-line);\n  border-radius: 8px;\n  cursor: pointer;\n}\n.wf-import input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }\n\n/* ------------------------------------------------- sidebar workflow entry */\n.wf-tree {\n  flex: none;\n  padding: 0 0 4px;\n  background: transparent;\n}\n.wf-nav-button {\n  display: flex;\n  width: calc(100% - 4px);\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  min-height: 36px;\n  margin: 0 2px;\n  padding: 7px 8px;\n  border: 0 !important;\n  border-radius: 12px;\n  background: transparent !important;\n  box-shadow: none !important;\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n  font-weight: 400;\n  line-height: 22px;\n  text-align: left;\n}\n.wf-nav-button:hover { background: var(--dsw-alias-interactive-bg-hover) !important; }\n.wf-nav-button.is-active {\n  background: var(--dsw-alias-interactive-bg-hover) !important;\n  color: var(--dsw-alias-label-primary);\n}\n.wf-nav-button.is-rail { width: 36px; height: 36px; justify-content: center; margin: 0; padding: 0; }\n.wf-nav-button:focus-visible { outline: 2px solid var(--dsw-alias-label-primary); outline-offset: -2px; }\n.wf-nav-button svg { width: 16px; height: 16px; flex: none; stroke-width: 1.8; }\n.wf-nav-button > span:not(.wf-nav-count) {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.wf-nav-count {\n  margin-left: auto;\n  padding: 0 7px;\n  border-radius: 999px;\n  background: var(--wf-surface-strong);\n  color: var(--wf-muted);\n  font-size: 11px;\n  font-weight: 600;\n  line-height: 18px;\n}\n.wf-workflow-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 22px;\n  height: 22px;\n  flex: none;\n  border-radius: 6px;\n  background: var(--wf-accent-soft);\n  color: var(--wf-accent);\n}\n.wf-icon-sparkles { background: color-mix(in srgb, #7c5cff 16%, transparent); color: #6b46e0; }\n.wf-icon-book { background: color-mix(in srgb, #2f7ad6 16%, transparent); color: #2464b3; }\n.wf-icon-search { background: color-mix(in srgb, #2f9e8b 16%, transparent); color: #1f7d6d; }\n.wf-icon-code { background: color-mix(in srgb, #d98324 18%, transparent); color: #9a5a13; }\n.wf-icon-file { background: color-mix(in srgb, #c7486e 16%, transparent); color: #a53458; }\n\n/* -------------------------------------------------------- workflow gallery */\n.wf-gallery-bar {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 0 0 12px;\n  color: var(--wf-muted);\n  font-size: 12px;\n}\n.wf-check { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; }\n.wf-check input { width: 16px; height: 16px; }\n.wf-gallery-empty {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 14px;\n  padding: 64px 24px;\n  color: var(--wf-muted);\n  text-align: center;\n}\n.wf-gallery-empty p { margin: 0; max-width: 440px; }\n.wf-cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));\n  align-items: start;\n  gap: 12px;\n  padding: 0 0 20px;\n}\n.wf-card {\n  display: flex;\n  min-width: 0;\n  flex-direction: column;\n  gap: 8px;\n  padding: 14px;\n  border: 1px solid var(--wf-line);\n  border-radius: var(--wf-radius);\n  background: var(--wf-surface);\n  box-shadow: var(--wf-shadow);\n}\n.wf-card-head {\n  display: flex;\n  width: 100%;\n  min-width: 0;\n  align-items: center;\n  gap: 8px;\n  padding: 0 !important;\n  border: 0 !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  text-align: left;\n}\n.wf-card-title {\n  min-width: 0;\n  overflow: hidden;\n  font-size: 14px;\n  font-weight: 600;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.wf-card-head .wf-chip { margin-left: auto; flex: none; }\n.wf-card-desc { margin: 0; min-height: 34px; color: var(--wf-muted); font-size: 12.5px; overflow-wrap: anywhere; }\n.wf-card-meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; color: var(--wf-muted); font-size: 11.5px; }\n.wf-card-actions > button { white-space: nowrap; }\n.wf-card-sessions { border-top: 1px solid var(--wf-line); padding-top: 4px; }\n.wf-card-sessions > summary {\n  padding: 2px 0;\n  color: var(--wf-muted);\n  cursor: pointer;\n  font-size: 12px;\n}\n.wf-card-sessions > summary:hover { color: var(--wf-text); }\n.wf-detail-row > td { padding: 2px 0 14px; }\n.wf-sessions { display: flex; flex-direction: column; gap: 2px; padding: 4px 0 2px; }\n.wf-session-row {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  min-height: 30px;\n  border-radius: 8px;\n}\n.wf-session-row:hover,\n.wf-session-row.selected { background: var(--wf-hover); }\n.wf-session-name {\n  display: flex;\n  flex: 1 1 auto;\n  min-width: 0;\n  align-items: center;\n  gap: 7px;\n  padding: 5px 8px;\n  border: 0 !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  color: var(--wf-muted);\n  font-size: 12.5px;\n  text-align: left;\n}\n.wf-session-name > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.wf-session-row.selected .wf-session-name { color: var(--wf-accent); font-weight: 500; }\n.wf-sessions-empty { margin: 4px 0 0; color: var(--wf-muted); font-size: 12px; }\n/* Row actions stay out of the way until the row is under the pointer. */\n.wf-session-row .wf-row-action,\n.wf-session-row .wf-session-menu-trigger {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  min-height: 24px;\n  flex: 0 0 24px;\n  margin-left: 1px;\n  padding: 0;\n  border: 0 !important;\n  background: transparent !important;\n  border-radius: 6px;\n  color: var(--wf-muted);\n  opacity: 0;\n}\n.wf-session-row:hover .wf-row-action,\n.wf-session-row:focus-within .wf-row-action,\n.wf-row-action[aria-expanded="true"] { opacity: 1; }\n.wf-session-row .wf-row-action:hover,\n.wf-session-row .wf-session-menu-trigger:hover {\n  background: var(--wf-surface-strong) !important;\n  color: var(--wf-text);\n}\n\n/* --------------------------------------------------- composer workflow tag */\n.wf-composer-tag {\n  display: inline-flex;\n  align-items: center;\n  gap: 2px;\n  max-width: min(340px, 42vw);\n  height: 26px;\n  border: 1px solid transparent;\n  border-radius: 999px;\n  font: 12px/1 var(--dsw-font-family, system-ui, sans-serif);\n}\n.wf-composer-tag[data-mode="author"] {\n  background: color-mix(in srgb, #6a5acd 14%, transparent);\n  border-color: color-mix(in srgb, #6a5acd 34%, transparent);\n  color: #5a49bd;\n}\n.wf-composer-tag[data-mode="run"] {\n  background: color-mix(in srgb, #2f9e6b 14%, transparent);\n  border-color: color-mix(in srgb, #2f9e6b 34%, transparent);\n  color: #1d7d52;\n}\n.wf-composer-tag-open {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  min-width: 0;\n  height: 24px;\n  padding: 0 8px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n}\n.wf-composer-tag-open:hover { background: color-mix(in srgb, currentcolor 14%, transparent); }\n.wf-composer-tag-open strong {\n  font-weight: 600;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.wf-composer-tag-open small { font-size: 11px; opacity: .72; }\n.wf-composer-tag .wf-status { padding: 0 6px; font-size: 11px; white-space: nowrap; }\n.wf-composer-tag-clear {\n  display: grid;\n  flex: none;\n  place-items: center;\n  width: 18px;\n  height: 18px;\n  margin-right: 3px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: inherit;\n  opacity: .72;\n  cursor: pointer;\n}\n.wf-composer-tag-clear:hover { background: color-mix(in srgb, currentcolor 16%, transparent); opacity: 1; }\n\n/* -------------------------------------------------------------- editor */\n.wf-editor { display: flex; flex: 1; min-height: 0; flex-direction: column; }\n.wf-editor-body {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 352px;\n  flex: 1;\n  min-height: 0;\n  background: var(--wf-surface-subtle);\n}\n.wf-stage {\n  display: flex;\n  flex: 1;\n  min-width: 0;\n  min-height: 0;\n  flex-direction: column;\n  position: relative;\n}\n.wf-canvas {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  min-width: 0;\n  min-height: 320px;\n  background-color: var(--wf-surface-subtle);\n  background-image: radial-gradient(color-mix(in srgb, var(--wf-muted) 35%, transparent) 1px, transparent 1px);\n  background-size: 20px 20px;\n}\n.wf-addbar {\n  position: absolute;\n  z-index: 6;\n  top: 14px;\n  left: 50%;\n  transform: translateX(-50%);\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  max-width: calc(100% - 24px);\n  padding: 5px;\n  border: 1px solid var(--wf-line);\n  border-radius: 999px;\n  background: var(--wf-surface);\n  box-shadow: var(--wf-shadow);\n  overflow-x: auto;\n  scrollbar-width: none;\n}\n.wf-addbar::-webkit-scrollbar { display: none; }\n.wf-addbar button {\n  flex: none;\n  gap: 7px;\n  min-height: 32px;\n  padding: 5px 11px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  font-size: 12px;\n  font-weight: 500;\n  white-space: nowrap;\n}\n.wf-addbar button:hover { background: var(--wf-surface-strong); }\n.wf-addbar button svg { color: var(--wf-muted); }\n.wf-addbar-divider { width: 1px; height: 20px; margin: 0 4px; background: var(--wf-line); }\n.wf-canvas-tools {\n  position: absolute;\n  z-index: 5;\n  bottom: 14px;\n  left: 56px;\n  display: flex;\n  gap: 2px;\n  padding: 4px;\n  border: 1px solid var(--wf-line);\n  border-radius: 12px;\n  background: var(--wf-surface);\n  box-shadow: var(--wf-shadow);\n}\n.wf-canvas-tools button { min-height: 28px; height: 28px; width: 28px; padding: 4px; border: 0; border-radius: 8px; background: transparent; }\n.wf-canvas-tools button[aria-pressed="true"] { background: var(--wf-accent-soft); color: var(--wf-accent); }\n.wf-flow { flex: 1; min-height: 0; }\n.wf-json { flex: 1; min-height: 0; padding: 16px; overflow: auto; }\n\n/* ---------------------------------------------------------- step cards */\n.wf .wf-step-input { --step-tint: #eef3a8; --step-ink: #454a15; --step-body: #f8fbdc; }\n.wf .wf-step-interact { --step-tint: #a9e7dc; --step-ink: #14504a; --step-body: #e6faf6; }\n.wf .wf-step-agent { --step-tint: #ccd9fb; --step-ink: #2c3f63; --step-body: #eef3fe; }\n.wf .wf-step-tool { --step-tint: #ffd9ab; --step-ink: #6b4413; --step-body: #fff2e2; }\n.wf .wf-step-condition { --step-tint: #ffc9dd; --step-ink: #6d2743; --step-body: #ffedf4; }\n.wf .wf-step-join { --step-tint: #d9d4fb; --step-ink: #3d3470; --step-body: #f1efff; }\n.wf .wf-step-loop { --step-tint: #c6ecf7; --step-ink: #1f4c5c; --step-body: #e9f7fc; }\n.wf .wf-step-subworkflow { --step-tint: #e3d3fb; --step-ink: #472e70; --step-body: #f5eeff; }\n.wf .wf-step-approval { --step-tint: #ffe1b8; --step-ink: #6d4a15; --step-body: #fff4e4; }\n.wf .wf-step-artifact { --step-tint: #c6f2d3; --step-ink: #1f5233; --step-body: #eafbf0; }\n.wf .wf-step-publish { --step-tint: #d5e8dc; --step-ink: #274a37; --step-body: #f0f7f3; }\n.wf-routing-settings,.wf-review-settings { margin-block: 12px; padding: 12px; border: 1px solid var(--wf-line); border-radius: 10px; }\n.wf-routing-settings summary,.wf-review-settings summary,.wf-team-editor summary { cursor: pointer; padding-block: 4px; font-weight: 500; }\n.wf-team-editor fieldset { border: 1px solid var(--wf-line); border-radius: 8px; padding: 10px; margin-block: 12px; }\n.wf-team-editor fieldset label { display: flex; align-items: center; gap: 8px; margin-block: 6px; }\n.wf-review-history { padding: 12px 0; }\n.wf-review-history section { margin-top: 12px; border-left: 2px solid var(--wf-line); padding-left: 12px; }\n.wf .wf-node { width: 264px !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }\n.wf .wf-node-card {\n  width: 264px;\n  padding: 0;\n  gap: 0;\n  overflow: hidden;\n  border: 1px solid color-mix(in srgb, var(--step-ink, #303742) 14%, transparent);\n  border-radius: var(--wf-radius);\n  background: var(--step-body, var(--wf-surface));\n  box-shadow: 0 1px 3px rgb(16 24 40 / 6%);\n  transition: box-shadow .15s ease;\n}\n.wf .wf-node-card.is-selected {\n  box-shadow: 0 0 0 2px var(--wf-accent), 0 10px 24px rgb(16 24 40 / 14%);\n}\n.wf .wf-step-heading {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 10px 14px;\n  background: var(--step-tint, #e5e7ee);\n  color: var(--step-ink, #303742);\n}\n.wf .wf-step-heading strong { flex: 1; min-width: 0; margin: 0; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.wf .wf-step-heading em { font-size: 11px; font-style: normal; opacity: .8; white-space: nowrap; }\n.wf .wf-step-glyph { display: inline-flex; flex: none; opacity: .85; }\n.wf .wf-step-body { display: grid; gap: 8px; padding: 12px 14px 14px; }\n.wf .wf-step-body p {\n  display: -webkit-box;\n  margin: 0;\n  overflow: hidden;\n  color: var(--wf-text);\n  font-size: 12.5px;\n  line-height: 1.6;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 3;\n}\n.wf .wf-step-body small { font-size: 12px; }\n.wf .wf-step-references { display: flex; flex-wrap: wrap; gap: 4px; max-height: 48px; overflow: auto; }\n.wf .wf-inline-reference {\n  display: inline-block;\n  padding: 1px 8px;\n  border-radius: 999px;\n  background: var(--step-tint, #e5e7ee);\n  color: var(--step-ink, #303742);\n  font-size: 11px;\n  vertical-align: baseline;\n}\n.wf .wf-step-model { color: var(--wf-muted); font-size: 11px; }\n.wf .wf-node-card .react-flow__handle { width: 9px; height: 9px; border: 2px solid var(--wf-surface); background: var(--step-ink, #303742); }\n.wf .react-flow__edge-path { stroke: color-mix(in srgb, var(--wf-accent) 72%, #7a5cc4); stroke-width: 1.6; }\n.wf .react-flow__edge.wf-edge-dashed .react-flow__edge-path { stroke-dasharray: 5 5; stroke: var(--wf-line-strong); }\n.wf .react-flow__controls { overflow: hidden; border: 1px solid var(--wf-line); border-radius: 10px; box-shadow: var(--wf-shadow); }\n.wf .react-flow__controls button { min-height: 28px; padding: 5px; border: 0; border-bottom: 1px solid var(--wf-line); border-radius: 0; background: var(--wf-surface); color: var(--wf-text); }\n.wf .react-flow__minimap { width: 130px; height: 84px; border: 1px solid var(--wf-line); border-radius: 10px; background: var(--wf-surface); overflow: hidden; }\n\n/* ------------------------------------------------------- step inspector */\n.wf-inspector {\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n  min-height: 0;\n  border-left: 1px solid var(--wf-line);\n  background: var(--wf-surface);\n}\n.wf-panel-tabs {\n  display: flex;\n  gap: 6px;\n  padding: 10px 12px 0;\n  flex: none;\n}\n.wf-panel-tabs button {\n  flex: 1;\n  min-height: 30px;\n  padding: 4px 6px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: var(--wf-muted);\n  font-size: 12px;\n  font-weight: 600;\n}\n.wf-panel-tabs button[aria-selected="true"] { background: var(--wf-accent-soft); color: var(--wf-accent); }\n.wf-panel-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 12px;\n  padding: 12px 14px;\n  border-radius: 12px;\n  background: var(--step-tint, var(--wf-surface-strong));\n  color: var(--step-ink, var(--wf-text));\n}\n.wf-panel-head strong { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.wf-panel-head em { font-size: 11px; font-style: normal; opacity: .8; }\n.wf-panel-head .wf-icon { color: inherit; }\n.wf-panel-body { flex: 1; min-height: 0; min-width: 0; padding: 0 14px 16px; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }\n.wf-panel-empty { padding: 24px 16px; color: var(--wf-muted); font-size: 12px; text-align: center; }\n.wf-panel-note { display: flex; align-items: center; gap: 6px; margin: 0 0 12px; color: var(--wf-muted); font-size: 11px; }\n.wf-agent-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }\n.wf-agent-row select { flex: 1; }\n.wf-output {\n  max-height: 320px;\n  margin: 0 0 12px;\n  padding: 12px;\n  overflow: auto;\n  border: 1px solid var(--wf-line);\n  border-radius: 10px;\n  background: var(--wf-surface-subtle);\n  font: 11px/1.6 ui-monospace, monospace;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n.wf-console { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }\n.wf-console li { display: flex; gap: 8px; padding: 7px 9px; border-radius: 8px; background: var(--wf-surface-subtle); font-size: 11px; }\n.wf-console li time { flex: none; color: var(--wf-muted); }\n.wf-console li span { min-width: 0; overflow-wrap: anywhere; }\n.wf-swatches { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 16px; }\n.wf-swatch { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 999px; background: var(--step-tint); color: var(--step-ink); font-size: 11px; }\n.wf-icon-picker { display: flex; flex-wrap: wrap; gap: 6px; }\n.wf-icon-picker button {\n  width: 34px;\n  height: 34px;\n  min-height: 34px;\n  padding: 7px;\n  border: 1px solid var(--wf-line);\n  border-radius: 10px;\n  background: var(--wf-surface);\n  color: var(--wf-muted);\n}\n.wf-icon-picker button[aria-pressed="true"] { border-color: var(--wf-accent); color: var(--wf-accent); background: var(--wf-accent-soft); }\n\n/* ---------------------------------------------------------- step fields */\n.wf-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 13px; font-size: 12px; }\n.wf-field > span { color: var(--wf-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; }\n.wf-prompt-label { display: flex; align-items: center; gap: 6px; margin: 4px 0 2px; color: var(--wf-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; }\n.wf-prompt-label button { width: 22px; height: 22px; min-height: 22px; padding: 3px; border: 0; background: transparent; color: var(--wf-muted); }\n.wf-step-prompt {\n  min-height: 150px;\n  margin-bottom: 10px;\n  padding: 12px 13px;\n  border: 1px solid transparent;\n  border-radius: 10px;\n  background: var(--wf-surface-subtle);\n  outline: none;\n  font: 13px/1.75 var(--dsw-font-family, system-ui);\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n.wf-step-prompt:hover { border-color: var(--wf-line); }\n.wf-step-prompt:focus { border-color: var(--wf-accent); background: var(--wf-surface); }\n.wf-step-prompt:empty::before { content: attr(data-placeholder); color: var(--wf-muted); pointer-events: none; }\n.wf-prompt-composer { display: flex; flex-direction: column; }\n.wf-add-reference { align-self: flex-start; min-height: 26px; padding: 2px 10px; border: 0; border-radius: 999px; background: var(--wf-surface-strong); color: var(--wf-muted); font-size: 11px; }\n.wf-reference-picker { display: grid; gap: 5px; padding-top: 10px; }\n.wf-reference-picker button { justify-content: flex-start; border: 0; background: var(--step-tint, var(--wf-surface-strong)); color: var(--step-ink, var(--wf-text)); }\n.wf-advanced { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--wf-line); }\n.wf-advanced summary { margin-bottom: 14px; color: var(--wf-muted); cursor: pointer; }\n\n\n/* --------------------------------------------------------------- modal */\n.wf-modal {\n  width: 620px;\n  max-width: calc(100vw - 24px);\n  max-height: calc(100dvh - 40px);\n  padding: 0;\n  border: 1px solid var(--wf-line);\n  border-radius: 14px;\n  background: var(--wf-bg);\n  color: var(--wf-text);\n  box-shadow: 0 24px 70px rgb(16 24 40 / 24%);\n  pointer-events: auto;\n}\n.wf-modal::backdrop { background: rgb(16 24 40 / 32%); }\n.wf-modal > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--wf-line); }\n.wf-modal-body { max-height: calc(100dvh - 120px); padding: 18px; overflow: auto; }\n.wf-modal pre { max-height: 280px; margin: 0; padding: 12px; overflow: auto; border-radius: 10px; background: var(--wf-surface-subtle); font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }\n.wf-search { display: flex; align-items: center; gap: 8px; }\n.wf-picker-list { display: grid; gap: 2px; max-height: 340px; margin: 14px 0; overflow: auto; }\n.wf-picker-list > button { justify-content: flex-start; gap: 10px; width: 100%; padding: 12px 10px; border: 0; border-radius: 10px; text-align: left; }\n.wf-picker-list > button > span:first-of-type { flex: 1; min-width: 0; overflow-wrap: anywhere; }\n.wf-picker-list strong { display: block; font-size: 13px; }\n.wf-status { color: var(--wf-muted); }\n.wf-status.completed { color: var(--dsw-alias-state-success-primary, #2f9e6b); font-weight: 600; }\n.wf-status.failed, .wf-status.needs_attention { color: var(--dsw-alias-state-error-primary, #b13e4a); }\n.wf-status.running { color: var(--dsw-alias-state-business-primary, #357bad); }\n.wf-status.waiting_input { color: var(--dsw-alias-state-warning-primary, #b07d1f); font-weight: 600; }\n.wf-interaction { display: grid; gap: 6px; margin: 12px 0; padding: 12px 14px; border: 1px solid var(--wf-line); border-left: 3px solid var(--wf-accent); border-radius: 10px; background: var(--wf-surface-subtle); }\n.wf-interaction p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }\n.wf-interaction small { color: var(--wf-muted); }\n.wf-interaction button { justify-self: start; }\n\n/* ------------------------------------------------------------ responsive */\n@media (max-width: 1100px) {\n  .wf-editor-body { grid-template-columns: minmax(0, 1fr) 300px; }\n  .wf-appbar { padding: 8px 10px; gap: 6px; }\n  .wf-appbar button { font-size: 11px; padding: 5px 8px; }\n  .wf-appbar-name { max-width: 160px; font-size: 14px !important; }\n}\n@media (max-width: 760px) {\n  .wf-main { overflow: hidden !important; }\n  .wf-appbar { flex-wrap: nowrap; overflow-x: auto; }\n  .wf-appbar .wf-spacer { display: none; }\n  .wf-appbar-name { flex: 1; min-width: 96px; max-width: none; }\n  .wf-editor-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(260px, 1fr) minmax(200px, 46vh); overflow: auto; }\n  .wf-canvas { min-width: 0; width: 100%; min-height: 260px; }\n  .wf-inspector { min-width: 0; border-left: 0; border-top: 1px solid var(--wf-line); }\n  .wf-addbar { max-width: calc(100% - 16px); padding: 4px; overflow-x: auto; }\n  .wf-addbar button { padding: 5px 9px; white-space: nowrap; }\n  .wf-tabs { overflow-x: auto; padding: 0 2px; }\n  .wf-tabs button { white-space: nowrap; }\n  .wf-segmented button { padding: 5px 9px; white-space: nowrap; }\n  .wf-canvas-tools { bottom: 8px; left: 50px; }\n  .wf-scroll { padding: 12px; }\n  .wf-scroll table { min-width: 420px; }\n  .wf-main table { display: table; width: 100%; table-layout: fixed; }\n  .wf-main th, .wf-main td { overflow: hidden; text-overflow: ellipsis; word-break: break-word; }\n}\n\n\n  body[data-ds-dark-theme] .wf {\n    --wf-bg: var(--dsw-alias-bg-base, #1f2023);\n    --wf-surface: var(--dsw-alias-bg-elevated, #25272b);\n    --wf-surface-subtle: var(--dsw-alias-bg-secondary, #1b1d20);\n    --wf-surface-strong: var(--dsw-alias-interactive-bg-hover, #30343a);\n    --wf-text: var(--dsw-alias-label-primary, #f2f4f7);\n    --wf-muted: var(--dsw-alias-label-secondary, #a7afb9);\n    --wf-line: var(--dsw-alias-border-l3, #3b4149);\n    --wf-line-strong: var(--dsw-alias-border-l2, #4a515b);\n    --wf-accent: var(--dsw-alias-brand-primary, #8f7ff0);\n  }\n  body[data-ds-dark-theme] .wf .wf-step-input { --step-tint: #3c4118; --step-ink: #e2ecab; --step-body: #24260f; }\n  body[data-ds-dark-theme] .wf .wf-step-interact { --step-tint: #17453f; --step-ink: #a9e7dc; --step-body: #0e2a26; }\n  body[data-ds-dark-theme] .wf .wf-step-agent { --step-tint: #26324f; --step-ink: #c3d3f8; --step-body: #1b2233; }\n  body[data-ds-dark-theme] .wf .wf-step-tool { --step-tint: #4a3316; --step-ink: #f6d3a4; --step-body: #2a1e0e; }\n  body[data-ds-dark-theme] .wf .wf-step-condition { --step-tint: #4b2131; --step-ink: #f8c2d6; --step-body: #2b131c; }\n  body[data-ds-dark-theme] .wf .wf-step-join { --step-tint: #322b57; --step-ink: #d3cbf8; --step-body: #1f1b36; }\n  body[data-ds-dark-theme] .wf .wf-step-loop { --step-tint: #173d4a; --step-ink: #bde6f4; --step-body: #0f262e; }\n  body[data-ds-dark-theme] .wf .wf-step-subworkflow { --step-tint: #3a2154; --step-ink: #dfc9f8; --step-body: #231434; }\n  body[data-ds-dark-theme] .wf .wf-step-approval { --step-tint: #4a3416; --step-ink: #f7d8aa; --step-body: #2b1f0e; }\n  body[data-ds-dark-theme] .wf .wf-step-artifact { --step-tint: #1c3f2a; --step-ink: #bdeecb; --step-body: #10261a; }\n  body[data-ds-dark-theme] .wf .wf-step-publish { --step-tint: #294336; --step-ink: #c9e8d5; --step-body: #182b21; }\n  body[data-ds-dark-theme] .wf .wf-node-card { box-shadow: 0 5px 18px rgb(0 0 0 / 32%); }\n  body[data-ds-dark-theme] .wf .wf-node-card .react-flow__handle { border-color: var(--step-body, #25272b); }\n\n\n/* --------------------------------------------------- composer tag (dark) */\n\n  body[data-ds-dark-theme] .wf-composer-tag[data-mode="author"] {\n    background: color-mix(in srgb, #8f7ff0 24%, transparent);\n    border-color: color-mix(in srgb, #8f7ff0 46%, transparent);\n    color: #d3caff;\n  }\n  body[data-ds-dark-theme] .wf-composer-tag[data-mode="run"] {\n    background: color-mix(in srgb, #46c08a 22%, transparent);\n    border-color: color-mix(in srgb, #46c08a 44%, transparent);\n    color: #b3ecd2;\n  }\n\n\n/* Conversation reading column */\n.wf-timeline { flex:0 0 auto; width:min(100%,880px); margin:0 auto 0 0; padding:12px 28px; min-width:0; background:var(--wf-bg); font-size:14px; line-height:1.8; text-align:left; }\n[data-phase] [data-conversation-scroll]:has(.wf-timeline) { justify-content: flex-start; }\n.wf-run-header { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; position:static; z-index:12; background:var(--wf-bg); padding:4px 0 12px; border-bottom:1px solid var(--wf-line); }\n.wf-run-header h2 { font-size: 16px; font-weight: 600; margin: 0; }\n.wf-run-caption,.wf-model-line,.wf-step-number,.wf-step-state { color: var(--wf-muted); font-size: 12px; }\n.wf-run-actions { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }\n.wf-timeline .wf-run-actions button { min-height: 26px; padding: 3px 7px; border: 0; background: transparent; color: var(--wf-muted); font-size: 12px; }\n.wf-timeline .wf-run-actions button:hover { color: var(--wf-text); background: var(--wf-hover); }\n.wf-run-header .wf-run-actions button { border: 1px solid var(--wf-line); border-radius: 16px; padding: 4px 10px; }\n.wf-run-step { min-width:0; padding:22px 20px; margin:20px 0; border-radius:10px; border:1px solid var(--wf-line); background:color-mix(in srgb,hsl(var(--wf-cell-hue) 26% 90%) 22%,var(--wf-bg)); }\n.wf-run-step > header { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }\n.wf-run-step h3 { margin: 0; flex: 1; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }\n.wf-step-state { display: inline-flex; align-items: center; gap: 5px; }\n.wf-model-line { margin: 1px 0 14px; overflow-wrap: anywhere; }\n.wf-input-note { margin: 0 0 16px auto; padding: 10px 14px; background: var(--wf-surface-subtle); border-radius: 14px; max-width: 90%; color: var(--wf-muted); font-size: 13px; }\n.wf-input-note summary { cursor: pointer; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.wf-input-note summary span { margin-left: 8px; }\n.wf-input-note[open] summary span { display: none; }\n.wf-timeline .wf-activity-toggle { border: 0; background: transparent; color: var(--wf-muted); padding: 2px 0; min-height: 24px; gap: 6px; font-size: 12px; }\n.wf-activity-toggle > span:last-child { opacity: .8; }\n.wf-step-answer { margin: 16px 0 18px; overflow-wrap: anywhere; }\n.wf-step-answer > small { display: block; font-size: 11px; color: var(--wf-muted); margin-bottom: 4px; }\n.wf-step-answer p,.wf-agent-prose p { line-height: 1.85; margin: 0 0 14px; }\n.wf-step-answer h1,.wf-step-answer h2,.wf-agent-prose h1,.wf-agent-prose h2 { font-size: 17px; margin: 16px 0 10px; }\n.wf-timeline pre:where(:not(.wf-native-step *)) { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 300px; overflow: auto; font-size: 12px; }\n.wf-trace { margin: 8px 0 16px; }\n.wf-trace details { margin: 7px 0; color: var(--wf-muted); font-size: 12px; }\n.wf-trace details summary { display: flex; gap: 6px; align-items: center; cursor: pointer; }\n.wf-agent-prose { margin: 16px 0; }\n.wf-team-member { margin: 14px 0; padding-left: 14px; border-left: 1px solid var(--wf-line); }\n.wf-team-member > strong { font-size: 13px; font-weight: 500; }\n.wf-team-member > span { margin: 0 8px; color: var(--wf-muted); font-size: 12px; }\n.wf-team-member > button { border: 0; background: transparent; font-size: 12px; color: var(--wf-muted); }\n.wf-run-step > details:last-child { color: var(--wf-muted); font-size: 12px; margin-top: 8px; }\n.wf-path { overflow-wrap: anywhere; color: var(--wf-muted); }\n.wf-run-composer { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0; border: 1px solid var(--wf-line); border-radius: 18px; padding: 12px; }\n.wf-run-composer label { display: flex; align-items: center; gap: 8px; font-size: 12px; }\n.wf-run-composer textarea { flex: 1; min-width: 180px; min-height: 70px; border: 0; background: transparent; padding: 6px; }\n.wf-run-composer select,.wf-recipient { max-width: 180px; background: transparent; border: 0; font-size: 12px; color: inherit; }\n.wf-debug-toggle { display: inline-flex; gap: 5px; align-items: center; padding: 0 6px; }\n.wf-step-return { display: flex; gap: 8px; align-items: center; }\n.wf-step-return button { border: 0; background: transparent; font-size: 12px; }\n.wf-confirm { position: fixed; z-index: 1000; top: 30%; left: 50%; transform: translateX(-50%); width: min(460px, 90vw); padding: 24px; border: 1px solid var(--wf-line-strong); border-radius: 14px; background: var(--wf-surface); box-shadow: 0 0 0 100vmax rgb(0 0 0 / 35%); }\n.wf-confirm button { margin-right: 8px; }\n.wf-spin { animation: wf-spin 1.5s linear infinite; }\n@keyframes wf-spin { to { transform: rotate(360deg); } }\n@media (prefers-reduced-motion: reduce) { .wf-spin { animation: none; } }\n@media (max-width: 700px) { .wf-timeline { padding: 20px 16px; } .wf-run-header { gap: 10px; } }\n\n.wf-native-step { width: 100%; min-width: 0; margin: 12px 0; }\n.wf-native-step [data-slot="conversation.view"] { min-width: 0; }\n.wf-native-step [data-conversation-view="chat"] { padding-inline: 0; }\n.wf-native-step nav[aria-label="\u8F6E\u6B21\u5BFC\u822A"] { display: none; }\n\n.wf-root-conversation { width:min(100%,880px); margin:0 auto 0 0; padding:12px 28px; color:var(--dsw-alias-label-primary,#202428); font-size:14px; }\n.wf-root-conversation > summary { cursor: pointer; }\n.wf-native-scroll { overflow:visible; max-height:none; overscroll-behavior:auto; }\n.wf-native-step [data-slot="conversation.view"] > div > div { padding-inline: 0; }\n.wf-step-views { display: flex; gap: 18px; border-bottom: 1px solid var(--wf-line); margin-bottom: 12px; }\n.wf-step-views button { background: transparent; border: 0; border-radius: 0; padding: 6px 0; color: var(--wf-muted); font-size: 12px; }\n.wf-step-views button[aria-selected="true"] { color: var(--wf-text); border-bottom: 2px solid currentColor; }\n\n/* Notebook cells share the page scrollport; embedded transcripts have no scroll range. */\n.wf-run-header h2 { font-size: 14px; }\n.wf-run-caption { font-size: 11px; }\n.wf-run-header select { max-width: 145px; font-size: 12px; border: 0; background: transparent; }\n.wf-run-header .wf-debug-toggle { font-size: 12px; }\nbody[data-ds-dark-theme] .wf-run-step { background:color-mix(in srgb,hsl(var(--wf-cell-hue) 16% 25%) 28%,var(--wf-bg)); }\n.wf-run-step.is-running { border-color: hsl(var(--wf-cell-hue) 25% 64%); }\n.wf-model-line { margin-bottom: 4px; }\n.wf-cell-toolbar { display: flex; align-items: center; gap: 3px; margin: 4px 0 12px; }\n.wf-cell-toolbar button,.wf-input-files button { border: 0; background: transparent; padding: 6px; min-height: 30px; color: var(--wf-muted); }\n.wf-cell-toolbar button:hover { color: var(--wf-text); background: var(--wf-surface-strong); }\n.wf-cell-toolbar button:focus-visible { outline: 2px solid var(--wf-accent); outline-offset: 2px; }\n.wf-cell-input { margin:12px 0 18px; width:100%; }\n.wf-input-bubble { padding: 12px 16px; border-radius: 16px; background: color-mix(in srgb, hsl(var(--wf-cell-hue) 35% 80%) 24%, var(--wf-bg)); white-space: pre-wrap; overflow-wrap: anywhere; }\n.wf-input-bubble p { margin: 2px 0; }\n.wf-cell-label { color: var(--wf-muted); font-size: 11px; }\n.wf-input-material { font-size: 12px; color: var(--wf-muted); margin-top: 8px; }\n.wf-input-material > div { margin-top: 8px; }\n.wf-input-editor { padding: 12px; border: 1px solid var(--wf-line); border-radius: 14px; background: var(--wf-bg); }\n.wf-input-editor textarea { width: 100%; min-height: 140px; resize: vertical; background: transparent; border: 0; padding: 4px; }\n.wf-input-editor .wf-cell-toolbar { margin-bottom: 0; }\n.wf-input-editor .wf-muted { margin-right: auto; font-size: 11px; }\n.wf-input-files { display: flex; gap: 6px; flex-wrap: wrap; }\n.wf-input-files > span { display: flex; align-items: center; font-size: 12px; }\n.wf-file-row { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-bottom: 8px; }\n.wf .wf-file-card { display: flex; align-items: center; gap: 10px; max-width: 260px; border: 1px solid var(--wf-line); border-radius: 12px; background: var(--wf-bg); padding: 10px 14px; text-align: left; }\n.wf-file-card strong { display: block; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.wf-file-card span { min-width: 0; }\n.wf-file-card small { display: block; color: var(--wf-muted); font-size: 11px; }\n.wf .wf-file-card.is-image { padding: 0; width: 78px; height: 78px; overflow: hidden; }\n.wf-file-card img { width: 100%; height: 100%; object-fit: cover; }\n.wf-cell-process:not(:empty) { margin: 8px 0 12px 14px; padding-left: 12px; border-left: 1px solid var(--wf-line); }\n.wf-step-answer { margin-bottom: 8px; }\n.wf-run-step > details:last-child { font-size: 11px; opacity: .8; }\n@media(max-width:700px) { .wf-timeline { padding: 0 8px; } .wf-run-step { padding: 12px; } .wf-cell-input { width: 100%; } .wf-run-header { gap: 4px; } }\n.wf-run-header > div:first-of-type { flex: 1 1 180px; }\n.wf-run-header .wf-run-actions { flex: 0 1 auto; flex-wrap: nowrap; }\n.wf-run-header select { width: auto; flex: 0 1 145px; }\n.wf-run-header .wf-debug-toggle { white-space: nowrap; }\n.wf-run-header .wf-debug-toggle input { width: auto; }\n.wf-run-header .wf-run-actions button { flex: 0 0 auto; }\n\n/* Workflow conversations follow the native reading rhythm. */\n.wf .wf-session-name { justify-content: flex-start; text-align: left; }\n.wf-session-name > svg { flex-shrink: 0; }\n.wf-input-bubble { border-radius: 12px; }\n.wf-file-row { justify-content: flex-start; }\n.wf-editor-debug { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 12px; padding: 0 8px; }\n.wf-editor-debug input { width: auto; margin: 0; }\n@media(max-width:700px) { .wf-timeline { padding: 8px 12px; } .wf-run-step { padding-inline: 8px; } }\n.wf-appbar { flex-wrap: wrap; }\n.wf-appbar > button,.wf-appbar > .wf-segmented,.wf-appbar > .wf-chip,.wf-appbar > .wf-editor-debug { flex-shrink: 0; white-space: nowrap; }\n.wf-appbar .wf-segmented button { white-space: nowrap; flex-shrink: 0; }\n@media(max-width:700px) { .wf-appbar { flex-wrap: wrap; overflow: visible; padding: 8px; gap: 6px; } .wf-appbar-name { max-width: 150px; } }\nbody[data-ds-dark-theme] .wf button:not(.wf-native-step *):not(.wf-primary):not(.wf-run-action) { background-color: var(--wf-bg); color: var(--wf-text); }\nbody[data-ds-dark-theme] .wf button:not(.wf-native-step *):not(.wf-primary):not(.wf-run-action):hover { background-color: var(--wf-surface-strong); }\n\n/* Reserve canvas space for the step palette at every viewport size. */\n.wf-canvas > .wf-flow { margin-top: 62px; }\n.wf-appbar button:disabled { background: var(--wf-surface-subtle); color: var(--wf-muted); border-color: var(--wf-line); opacity: .65; }\n\n/* Shared hierarchy for browsing, editing and reading workflows. */\n.wf-gallery { padding: 24px 28px; }\n.wf-gallery-bar { flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }\n.wf-gallery-search { display: flex; align-items: center; gap: 8px; flex: 0 1 280px; min-width: 180px; padding: 0 10px; border: 1px solid var(--wf-line); border-radius: 9px; background: var(--wf-surface); }\n.wf .wf-gallery-search input { border: 0; background: transparent; padding: 8px 0; }\n.wf-gallery-search:focus-within { outline: 2px solid var(--wf-accent); outline-offset: 2px; }\n.wf .wf-gallery-search input:focus-visible { outline: 0; }\n.wf-gallery-count { font-size: 12px; color: var(--wf-muted); font-variant-numeric: tabular-nums; }\n.wf-search-clear { flex: none; min-height: 22px; min-width: 22px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--wf-muted); }\n.wf .wf-search-clear:hover { background: var(--wf-hover); color: var(--wf-text); }\n.wf-gallery-feedback { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; padding: 9px 12px; border: 1px solid var(--wf-line); border-left: 3px solid var(--wf-accent); border-radius: 10px; background: var(--wf-surface-subtle); font-size: 13px; }\n.wf-gallery-feedback > span { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }\n.wf-gallery-feedback > button { flex: none; min-height: 28px; }\n.wf-card-actions > .wf-archive-action { color: var(--wf-muted); }\n.wf .wf-card-actions > .wf-archive-action:hover { color: var(--dsw-alias-state-error-primary, #b13e4a); border-color: var(--wf-line-strong); background: var(--wf-surface-strong); }\n.wf-error-bar { display: flex; align-items: center; gap: 10px; margin: 0 16px 8px; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #b13e4a) 32%, var(--wf-line)); border-radius: 10px; background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #b13e4a) 8%, transparent); }\n.wf-error-bar .wf-error { flex: 1 1 auto; min-width: 0; margin: 0; font-size: 12.5px; }\n.wf-error-bar > button { flex: none; min-height: 26px; }\n.wf-cards { grid-template-columns: repeat(auto-fill, minmax(min(100%, 292px), 1fr)); gap: 14px; }\n.wf-card { padding: 16px; gap: 11px; box-shadow: none; border-radius: 12px; }\n/* A name or description of any length is clamped to a fixed number of lines, so one\n   long record cannot size the grid and push every other card out of view. The full\n   text stays available through the element\'s title attribute. */\n.wf-card-title {\n  display: -webkit-box;\n  overflow: hidden;\n  font-size: 15px;\n  line-height: 1.45;\n  overflow-wrap: anywhere;\n  white-space: normal;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 1;\n}\n.wf-card-desc {\n  display: -webkit-box;\n  min-height: 40px;\n  overflow: hidden;\n  font-size: 13px;\n  line-height: 1.65;\n  overflow-wrap: anywhere;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n}\n.wf-list-title,\n.wf-list-desc {\n  display: block;\n  max-width: 42ch;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.wf-card-meta { font-size: 12px; }\n.wf-card-actions {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, auto));\n  justify-content: start;\n  gap: 6px;\n  padding-block: 4px;\n}\n.wf-card-actions > button { min-width: 0; min-height: 34px; padding-inline: 6px; font-size: 12.5px; white-space: nowrap; }\n.wf-card-actions > button:not(.wf-run-action) { border-color: transparent; background: transparent; }\n/* The card\'s run action reads as the primary affordance through tint and ink\n   rather than the near-black/near-white solid fill `.wf-primary` uses in the\n   editor: on a gallery card that fill dominated the row it sits in. The ink is\n   the palette\'s own brand blue instead of `--wf-accent`, which follows\n   `--dsw-alias-brand-primary` and inverts to near-white in the dark theme. */\n.wf .wf-card-actions > .wf-run-action {\n  background: color-mix(in srgb, var(--dsw-static-deepseek-500, #4176e6) 12%, transparent);\n  border-color: color-mix(in srgb, var(--dsw-static-deepseek-500, #4176e6) 30%, transparent);\n  color: var(--dsw-static-deepseek-500, #4176e6);\n  font-weight: 600;\n}\n.wf .wf-card-actions > .wf-run-action:hover {\n  background: color-mix(in srgb, var(--dsw-static-deepseek-500, #4176e6) 20%, transparent);\n  border-color: color-mix(in srgb, var(--dsw-static-deepseek-500, #4176e6) 45%, transparent);\n  color: var(--dsw-static-deepseek-500, #4176e6);\n}\nbody[data-ds-dark-theme] .wf .wf-card-actions > .wf-run-action {\n  background: color-mix(in srgb, var(--dsw-static-deepseek-400, #679efe) 16%, transparent);\n  border-color: color-mix(in srgb, var(--dsw-static-deepseek-400, #679efe) 34%, transparent);\n  color: var(--dsw-static-deepseek-400, #679efe);\n}\nbody[data-ds-dark-theme] .wf .wf-card-actions > .wf-run-action:hover {\n  background: color-mix(in srgb, var(--dsw-static-deepseek-400, #679efe) 24%, transparent);\n  border-color: color-mix(in srgb, var(--dsw-static-deepseek-400, #679efe) 50%, transparent);\n  color: var(--dsw-static-deepseek-400, #679efe);\n}\n.wf-card-sessions { padding-top: 10px; }\n.wf-card-sessions > summary { padding: 6px 0; font-size: 13px; color: var(--wf-text); }\n.wf-card-sessions > summary:focus-visible { outline: 2px solid var(--wf-accent); outline-offset: 3px; border-radius: 4px; }\n.wf .wf-session-name { min-height: 38px; padding-inline: 8px; }\n.wf-sessions-empty { font-size: 12px; line-height: 1.7; padding: 4px 0; }\n.wf-addbar { border-radius: 12px; box-shadow: 0 2px 8px rgb(0 0 0 / 4%); }\n.wf-addbar button { border-radius: 8px; min-height: 34px; }\n.wf .wf-node-card { background: color-mix(in srgb, var(--step-body) 45%, var(--wf-surface)); box-shadow: 0 1px 2px rgb(0 0 0 / 4%); }\n.wf .wf-node-card.is-selected { box-shadow: 0 0 0 2px var(--wf-accent); }\n.wf .wf-step-heading { background: color-mix(in srgb, var(--step-tint) 40%, var(--wf-surface)); padding-block: 12px; }\n.wf .wf-step-body { gap: 10px; padding-block: 14px 16px; }\n.wf .react-flow__edge-path { stroke: var(--wf-muted); stroke-width: 1.3; }\n.wf-routing-settings,.wf-review-settings { border: 0; border-bottom: 1px solid var(--wf-line); border-radius: 0; padding: 10px 0; }\n.wf-panel-tabs { gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--wf-line); }\n.wf-panel-tabs button { border-radius: 7px; }\n.wf-input-bubble { background: transparent; border-left: 2px solid var(--wf-line-strong); border-radius: 0; padding: 8px 14px; }\n.wf-cell-label,.wf-model-line,.wf-run-caption { font-size: 12px; }\n.wf-cell-toolbar { gap: 6px; }\n.wf-cell-toolbar button { min-width: 34px; min-height: 34px; }\n.wf-root-conversation > summary { padding: 12px 0; color: var(--dsw-alias-label-secondary, #6c747c); font-size: 13px; }\n@media(max-width:700px) {\n  .wf-gallery { padding: 16px; }\n  .wf-gallery-search { flex: 1 1 100%; }\n  .wf-card { padding: 16px; }\n  .wf-addbar { max-width: calc(100% - 16px); }\n  .wf-addbar button { padding-inline: 8px; }\n  .wf-run-step { padding: 16px 12px; }\n}\n@media(prefers-reduced-motion:reduce) { .wf *, .wf *::before, .wf *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; } }\n.wf-editor-viewbar { display:flex; align-items:center; gap:16px; padding:10px 16px; border-bottom:1px solid var(--wf-line); }\n.wf-outline { flex:1; min-height:0; overflow:auto; padding:82px 24px 72px; background:var(--wf-bg); }\n.wf-outline > header { margin-bottom:24px; }\n.wf .wf-outline-step { display:flex; align-items:flex-start; gap:14px; width:100%; padding:18px; margin-bottom:12px; text-align:left; border-radius:12px; background:var(--wf-surface); }\n.wf .wf-outline-step[aria-pressed="true"] { border-color:var(--wf-accent); background:color-mix(in srgb,var(--wf-accent) 4%,var(--wf-surface)); }\n.wf-outline-number { color:var(--wf-muted); font-size:12px; font-variant-numeric:tabular-nums; padding-top:2px; }\n.wf-outline-copy { flex:1; min-width:0; display:grid; gap:8px; }\n.wf-outline-copy strong { font-size:14px; }\n.wf-outline-copy > span { color:var(--wf-muted); font-size:13px; line-height:1.65; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }\n.wf-outline-copy small { font-size:12px; color:var(--wf-muted); overflow-wrap:anywhere; }\n/* Workflow cells own their reading width; native resize rails belong to plain chat. */\n[data-phase="active"]:has(.wf-timeline) > [data-width-handle],\n[data-phase="active"]:has(.wf-timeline) [data-width-handle] { display:none; }\nbody[data-ds-dark-theme] .wf .wf-primary { color:var(--dsw-alias-bg-base,#141414); }\nbody[data-ds-dark-theme] .wf .wf-primary:hover { color:var(--dsw-alias-bg-base,#141414); }\n/* The add toolbar occupies a separate row above the scrollable content. */\n.wf-canvas > .wf-addbar { position:static; transform:none; flex:0 0 auto; align-self:stretch; max-width:none; margin:12px; justify-content:flex-start; box-shadow:none; }\n.wf-canvas > .wf-flow { margin-top:0; }\n.wf-outline { padding-top:16px; }\n.wf-outline-row { position:relative; }\n.wf .wf-outline-step { padding-right:58px; }\n.wf .wf-outline-delete { position:absolute; right:14px; top:14px; min-height:32px; width:32px; padding:6px; background:transparent; border:0; color:var(--wf-muted); }\n.wf-outline-step > svg { display:none; }\n.wf-editor-notice { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:8px 16px; border-bottom:1px solid var(--wf-line); font-size:12px; }\n.wf-editor-notice > span { flex:1; }\n.wf .wf-editor-notice button { border:0; }\n.wf-panel-head { background:var(--wf-surface); color:var(--wf-text); border-bottom:1px solid var(--wf-line); border-radius:0; margin:0; padding:16px; }\n.wf-panel-head strong { white-space:normal; font-size:14px; }\n.wf .wf-delete-step { border:0; color:var(--wf-muted); padding:6px 8px; min-height:32px; background:transparent; font-size:12px; }\n.wf-panel-body { padding:16px; }\n.wf-settings-group { padding:14px 0; border-bottom:1px solid var(--wf-line); }\n.wf-settings-group > summary { cursor:pointer; font-size:13px; font-weight:500; padding:4px 0; }\n.wf-settings-group > summary small { margin-left:8px; color:var(--wf-muted); font-weight:400; }\n.wf-settings-group .wf-field { margin-top:12px; }\n.wf-panel-body .wf-step-prompt { min-height:150px; max-height:320px; overflow:auto; font-size:14px; line-height:1.75; }\n.wf .wf-panel-tabs button { border-radius:0; background:transparent; border-bottom:2px solid transparent; }\n.wf .wf-panel-tabs button[aria-selected="true"] { border-bottom-color:var(--wf-accent); background:transparent; }\n.wf-canvas-tools { bottom:12px; }\n.wf-canvas-tools button:first-child:not(.wf-icon) { width:auto; padding-inline:10px; }\n.wf .react-flow__node.selected .wf-node-card { box-shadow:0 0 0 2px var(--wf-accent); }\n.wf .react-flow__edge:hover .react-flow__edge-path { stroke:var(--wf-accent); stroke-width:2; }\n@media(max-width:760px) { .wf-outline { padding-top:12px; } .wf-panel-body { padding:12px; } }\n.wf-more-steps { position:relative; flex:none; }\n.wf-more-menu { position:absolute; z-index:30; top:calc(100% + 8px); left:0; width:230px; padding:6px; border:1px solid var(--wf-line); border-radius:12px; background:var(--wf-surface); box-shadow:0 12px 30px rgb(16 24 40 / 16%); }\n.wf-more-menu button { display:flex; justify-content:flex-start; width:100%; min-height:42px; padding:7px 9px; border:0; border-radius:8px; background:transparent; text-align:left; }\n.wf-more-menu button:hover { background:var(--wf-surface-strong); }\n.wf-more-menu button > span { display:grid; gap:2px; }\n.wf-more-menu button small { font-size:11px; color:var(--wf-muted); }\n.wf-skill-editor { display:grid; gap:8px; }\n.wf-skill-chips { display:flex; flex-wrap:wrap; gap:6px; }\n.wf-skill-chips > span { display:inline-flex; align-items:center; gap:4px; padding:5px 8px; border-radius:7px; background:var(--wf-accent-soft); color:var(--wf-accent); font-size:12px; }\n.wf-skill-chips button { border:0; background:transparent; color:inherit; padding:0 2px; min-height:20px; }\n.wf-skill-add { display:flex; gap:6px; }\n.wf-skill-add input { flex:1; }\n.wf-skill-add button { flex:none; }\n.wf-review-settings > summary small { display:block; margin:4px 0 0 20px; color:var(--wf-muted); font-weight:400; }\n.wf .react-flow__edge.wf-edge-loop .react-flow__edge-path { stroke:var(--wf-accent); stroke-width:2; stroke-dasharray:7 5; }\n.wf .react-flow__edge.wf-edge-loop .react-flow__edge-text { fill:var(--wf-accent); font-size:11px; font-weight:600; }\n.wf .react-flow__edge-path { stroke-linecap:round; }\n.wf .react-flow__edge.selected .react-flow__edge-path { stroke:var(--wf-accent); stroke-width:2.5; }\n\n.wf-step-picker { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }\n.wf .wf-step-picker button { justify-content:flex-start; min-height:56px; padding:14px; }\n.wf-skill-content { min-height:45vh; width:100%; font:13px/1.6 ui-monospace,monospace; margin:12px 0; }\n.wf-settings-group > summary,.wf-routing-settings > summary,.wf-review-settings > summary,.wf-advanced > summary { display:flex; align-items:center; gap:8px; list-style:none; min-height:40px; font-size:13px; font-weight:500; }\n.wf-settings-group > summary::-webkit-details-marker,.wf-routing-settings > summary::-webkit-details-marker,.wf-review-settings > summary::-webkit-details-marker,.wf-advanced > summary::-webkit-details-marker { display:none; }\n.wf-settings-group > summary::before,.wf-routing-settings > summary::before,.wf-review-settings > summary::before,.wf-advanced > summary::before { content:\'\u203A\'; font-size:18px; color:var(--wf-muted); }\n.wf-settings-group[open] > summary::before,.wf-routing-settings[open] > summary::before,.wf-review-settings[open] > summary::before,.wf-advanced[open] > summary::before { transform:rotate(90deg); }\n.wf-settings-group > summary small,.wf-setting-value { display:inline!important; margin:0 0 0 auto; font-size:12px; color:var(--wf-muted); }\n.wf-settings-group,.wf-routing-settings,.wf-review-settings { padding:4px 0; margin:0; }\n.wf .wf-node-order { display:grid; place-items:center; border-radius:6px; min-width:23px; height:23px; background:var(--wf-surface); font-size:12px; }\n.wf .wf-step-heading { background:var(--wf-surface); border-bottom:1px solid var(--wf-line); }\n.wf .wf-node-card { border:1px solid var(--wf-line-strong); border-radius:12px; box-shadow:0 2px 5px rgb(0 0 0 / 5%); }\n.wf .wf-step-body p { -webkit-line-clamp:2; }\n.wf-addbar { overflow:visible; }\n.wf-canvas > .wf-addbar { flex-wrap:wrap; }\n.wf .wf-step-picker button span { font-weight:500; }\n\n/* Keep expanded inspector content inside a stable, scrollable grid row. */\n.wf-editor-body { grid-template-rows: minmax(0, 1fr); overflow: hidden; }\n.wf-inspector { overflow: hidden; }\n.wf-panel-head { flex-shrink: 0; }\n.wf-panel-body { flex: 1 1 0; overscroll-behavior: contain; padding-bottom: 32px; }\n.wf-step-picker { gap: 12px; }\n.wf .wf-step-picker button { min-height: 64px; padding: 16px; }\n@media(max-width:760px) { .wf-editor-body { grid-template-rows:minmax(260px,1fr) minmax(200px,46vh); overflow:auto; } }\n@media(max-width:480px) { .wf-step-picker { grid-template-columns:minmax(0,1fr); } }\n';

// lib/graph-edit.js
var tokenFor = (key) => `{{input.${key}}}`;
function canConnect(def, from, to) {
  if (from === to || !def.nodes.some((n) => n.id === from) || !def.nodes.some((n) => n.id === to)) return false;
  const seen = /* @__PURE__ */ new Set();
  const visit = (id2) => {
    if (id2 === from) return true;
    if (seen.has(id2)) return false;
    seen.add(id2);
    return def.edges.filter((e) => e.from === id2).some((e) => visit(e.to));
  };
  return !visit(to);
}
function connectReference(def, from, to, append = true) {
  if (!canConnect(def, from, to)) throw new Error("\u6B64\u8FDE\u63A5\u4F1A\u5F62\u6210\u5FAA\u73AF");
  const source = def.nodes.find((n) => n.id === from);
  const target = def.nodes.find((n) => n.id === to);
  const existing = Object.entries(target.input ?? {}).find(([, r]) => r.source === "node" && r.nodeId === from);
  let key = existing?.[0] ?? (target.kind === "artifact" && !target.input?.content ? "content" : from);
  while (!existing && Object.hasOwn(target.input ?? {}, key)) key += "_output";
  const ref = existing?.[1] ?? { source: "node", nodeId: from, path: source.kind === "agent" && !source.outputSchema ? "/text" : "" };
  const token = tokenFor(key);
  return { definition: {
    ...def,
    edges: def.edges.some((e) => e.from === from && e.to === to) ? def.edges : [...def.edges, { from, to }],
    nodes: def.nodes.map((n) => n.id !== to ? n : {
      ...n,
      input: { ...n.input, [key]: ref },
      ...n.kind === "agent" && append && !n.prompt?.includes(token) ? { prompt: `${n.prompt ?? ""}
${token}`.trim() } : {}
    })
  }, key };
}
function removeGraphItems(def, ids = [], edges = []) {
  const removed = new Set(ids);
  const next = { ...def, nodes: def.nodes.filter((n) => !removed.has(n.id)), edges: def.edges.filter((e) => !removed.has(e.from) && !removed.has(e.to) && !edges.includes(`${e.from}:${e.to}`)) };
  const ancestors = (id2) => {
    const seen = /* @__PURE__ */ new Set();
    const visit = (target) => next.edges.filter((e) => e.to === target).forEach((e) => {
      if (!seen.has(e.from)) {
        seen.add(e.from);
        visit(e.from);
      }
    });
    visit(id2);
    return seen;
  };
  next.nodes = next.nodes.map((n) => {
    let prompt = n.prompt;
    const upstream = ancestors(n.id);
    const input = Object.fromEntries(Object.entries(n.input ?? {}).filter(([key, ref]) => {
      if (ref.source !== "node" || upstream.has(ref.nodeId)) return true;
      prompt = prompt?.split(tokenFor(key)).join("").split(`{{node.${ref.nodeId}}}`).join("");
      return false;
    }));
    return { ...n, input, ...prompt === void 0 ? {} : { prompt } };
  });
  next.outputs = Object.fromEntries(Object.entries(next.outputs ?? {}).filter(([, r]) => r.source !== "node" || !removed.has(r.nodeId)));
  return next;
}
function pasteNodes(def, copied) {
  const ids = new Map(copied.nodes.map((n) => [n.id, `node_${crypto.randomUUID().slice(0, 8)}`]));
  const nodes = copied.nodes.map((original) => {
    const n = structuredClone(original);
    return {
      ...n,
      id: ids.get(n.id),
      name: `${n.name} \u526F\u672C`,
      position: { x: (n.position?.x ?? 80) + 48, y: (n.position?.y ?? 80) + 48 },
      input: Object.fromEntries(Object.entries(n.input ?? {}).map(([k, r]) => [k, r.source === "node" && ids.has(r.nodeId) ? { ...r, nodeId: ids.get(r.nodeId) } : r]))
    };
  });
  const edges = copied.edges.filter((e) => ids.has(e.to) && (ids.has(e.from) || def.nodes.some((n) => n.id === e.from))).map((e) => ({ ...e, from: ids.get(e.from) ?? e.from, to: ids.get(e.to) }));
  return { ...def, nodes: [...def.nodes, ...nodes], edges: [...def.edges, ...edges] };
}

// client/run-timeline.jsx
var import_react9 = __toESM(require("react"), 1);

// client/native-step.jsx
var import_react7 = __toESM(require("react"), 1);
var import_jsx_runtime4 = require("react/jsx-runtime");
function NativeStep({ ctx, sessionId, parentSessionId }) {
  const view = "chat";
  const [ready, setReady] = (0, import_react7.useState)(false), [error, setError] = (0, import_react7.useState)("");
  (0, import_react7.useEffect)(() => {
    let alive = true;
    const connect = async () => {
      try {
        await ctx.sessions.refresh();
        await ctx.sessions.refreshSubagents(parentSessionId);
        for (let i = 0; i < 60; i++) {
          const binding = ctx.sessions.binding(sessionId);
          if (binding) {
            if (typeof binding.session.open !== "function") throw new Error("\u5F53\u524D Harness \u7248\u672C\u4E0D\u652F\u6301\u5D4C\u5165\u6B65\u9AA4\u4F1A\u8BDD");
            const catalog = ctx.sessions.list.getSnapshot().subagentsByParent[parentSessionId];
            const member = catalog?.entries.find((e) => e.kind === "child" && e.id === sessionId);
            const address = member && { parentSessionId, childSessionId: sessionId, mode: member.mode };
            if (!address) throw new Error("\u6B65\u9AA4\u4F1A\u8BDD\u5730\u5740\u5C1A\u672A\u5C31\u7EEA");
            binding.session.configureSubagent(address, true);
            await binding.session.open();
            const snapshot = binding.session.getSnapshot();
            if (snapshot.openState === "error") throw new Error(snapshot.openError?.message ?? "\u6B65\u9AA4\u5386\u53F2\u52A0\u8F7D\u5931\u8D25");
            if (alive) setReady(true);
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error("\u6B65\u9AA4\u4F1A\u8BDD\u5C1A\u672A\u5C31\u7EEA");
      } catch (e) {
        if (alive) setError(e.message);
      }
    };
    connect();
    return () => {
      alive = false;
    };
  }, [ctx, sessionId, parentSessionId]);
  const surface = (0, import_react7.useMemo)(() => {
    if (!ready) return null;
    const registry = ctx.slots;
    if (!registry.hostFace || !registry._renderer) return null;
    const base = registry.hostFace(), adapter = base.scope("session"), binding = adapter?.resolve(sessionId);
    if (!binding) return null;
    const current = { getSnapshot: () => binding, subscribe: () => () => {
    } };
    const Entry = (props) => props.renderSlot("conversation.view", { openView: () => {
    }, completeViewRequest: () => {
    } }, { only: view });
    const entry = { component: Entry, options: {}, children: { "conversation.view": { kind: "list", scope: "session" } } };
    const host = {
      ...base,
      scope: () => ({ ...adapter, current, resolve: (id2) => adapter.resolve(id2) }),
      entriesOf: (key) => key === "root" ? [entry] : base.entriesOf(key),
      entriesOfSlot: (key) => key === "root" ? [entry] : base.entriesOfSlot(key),
      isLive: (value) => value === entry || base.isLive(value),
      storeOf: (value, scope) => value === entry ? void 0 : base.storeOf(value, scope)
    };
    return registry._renderer.renderRoot(host, {});
  }, [ready, ctx, sessionId, view]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "wf-native-step", "data-native-step": sessionId, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { "data-conversation-scroll": "", className: "wf-native-scroll", children: error ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { role: "alert", children: error }) : surface ?? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "wf-muted", children: "\u6B63\u5728\u8BFB\u53D6\u6B65\u9AA4\u4F1A\u8BDD\u2026" }) }) });
}

// client/run-timeline.jsx
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// client/step-input.jsx
var import_react8 = __toESM(require("react"), 1);
var import_jsx_runtime5 = require("react/jsx-runtime");
function IconButton({ label, icon: Icon3, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", "aria-label": label, title: label, ...props, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon3, { size: 16, "aria-hidden": "true" }) });
}
function FileCard({ api, runId, block }) {
  const ref = block.attachment, [preview, setPreview] = (0, import_react8.useState)("");
  (0, import_react8.useEffect)(() => {
    if (block.type !== "image") return;
    let alive = true;
    api({ action: "stepFile", runId, attachmentId: ref.attachmentId }).then((file) => {
      if (alive) setPreview(`data:${file.mediaType};base64,${file.data}`);
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, [ref.attachmentId, runId]);
  const [error, setError] = (0, import_react8.useState)("");
  const download2 = async () => {
    try {
      const file = await api({ action: "stepFile", runId, attachmentId: ref.attachmentId });
      const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mediaType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    } catch (e) {
      setError(e.message);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: `wf-file-card ${preview ? "is-image" : ""}`, onClick: download2, title: error || ref.name, "aria-label": `\u4E0B\u8F7D ${ref.name}`, children: preview ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: preview, alt: ref.name }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FileText, { size: 24 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: ref.name }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("small", { children: [
        Math.max(1, Math.round(ref.bytes / 1024)),
        " KB"
      ] })
    ] })
  ] }) });
}
function StepInput({ api, run, node, state, busy: busy2, act, editing, setEditing }) {
  const saved = run.stepOverrides?.[node.id], [prompt, setPrompt] = (0, import_react8.useState)(""), [files, setFiles] = (0, import_react8.useState)([]), [keep, setKeep] = (0, import_react8.useState)([]), [error, setError] = (0, import_react8.useState)("");
  const picker = (0, import_react8.useRef)(null);
  (0, import_react8.useEffect)(() => {
    if (editing) {
      setPrompt(saved?.prompt ?? node.prompt ?? "");
      setKeep((saved?.attachments ?? []).map((a) => a.attachment.attachmentId));
      setFiles([]);
      setError("");
    }
  }, [editing]);
  const inherited = state.input?.attachments ?? [];
  const cards = [...new Map([...inherited, ...saved?.attachments ?? []].map((b) => [b.attachment.attachmentId, b])).values()];
  const material = Object.entries(state.input ?? {}).filter(([k]) => k !== "attachments").map(([k, v]) => typeof v === "string" ? v : `${k}: ${JSON.stringify(v)}`).join("\n\n");
  const add = async (items) => {
    if (files.length + keep.length + items.length > 12 || [...files, ...items].reduce((sum, f) => sum + (f.size ?? f.bytes ?? 0), 0) > 8 * 1024 * 1024) {
      setError("\u6700\u591A 12 \u4E2A\u9644\u4EF6\uFF0C\u5408\u8BA1\u4E0D\u8D85\u8FC7 8 MB");
      return;
    }
    const uploaded = await Promise.all([...items].map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve({ name: file.name, mediaType: file.type, bytes: file.size, data: String(reader.result).split(",")[1] });
      reader.readAsDataURL(file);
    })));
    setFiles((v) => [...v, ...uploaded]);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "wf-cell-input", "aria-label": "\u6B65\u9AA4\u8F93\u5165", children: [
    cards.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "wf-file-row", children: cards.map((block) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FileCard, { api, runId: run.id, block }, block.attachment.attachmentId)) }),
    editing ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "wf-input-editor", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("textarea", { "aria-label": "\u6B65\u9AA4\u8F93\u5165 prompt", value: prompt, onChange: (e) => setPrompt(e.target.value), autoFocus: true }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "wf-input-files", children: [
        (saved?.attachments ?? []).filter((b) => keep.includes(b.attachment.attachmentId)).map((b) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
          b.attachment.name,
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconButton, { label: `\u79FB\u9664 ${b.attachment.name}`, icon: X, onClick: () => setKeep((v) => v.filter((id2) => id2 !== b.attachment.attachmentId)) })
        ] }, b.attachment.attachmentId)),
        files.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
          f.name,
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconButton, { label: `\u79FB\u9664 ${f.name}`, icon: X, onClick: () => setFiles((v) => v.filter((_, index2) => index2 !== i)) })
        ] }, i))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { ref: picker, type: "file", multiple: true, hidden: true, "aria-label": "\u6DFB\u52A0\u6B65\u9AA4\u6587\u4EF6", onChange: (e) => {
        add(e.target.files).catch(() => setError("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25"));
        e.target.value = "";
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "wf-cell-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconButton, { label: "\u6DFB\u52A0\u6587\u4EF6", icon: Paperclip, onClick: () => picker.current?.click() }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "wf-muted", children: "\u672C\u6B21\u8FD0\u884C" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconButton, { label: "\u4FDD\u5B58\u8F93\u5165", icon: Check, disabled: busy2, onClick: async () => {
          const result = await act({ action: "stepEdit", runId: run.id, nodeId: node.id, prompt, keep, files, expectedRevision: run.checkpointRevision });
          if (result) setEditing(false);
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconButton, { label: "\u53D6\u6D88\u7F16\u8F91", icon: X, onClick: () => setEditing(false) })
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { role: "alert", children: error })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "wf-input-bubble", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "wf-cell-label", children: "\u8F93\u5165" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: saved?.prompt || state.prompt || node.prompt || node.name }),
      material && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("details", { className: "wf-input-material", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("summary", { children: "\u8F93\u5165\u6750\u6599" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: material })
      ] })
    ] })
  ] });
}

// client/run-timeline.jsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var names = { queued: "\u7B49\u5F85\u6267\u884C", running: "\u6267\u884C\u4E2D", completed: "\u5DF2\u5B8C\u6210", paused: "\u7B49\u5F85\u68C0\u89C6", waiting_input: "\u7B49\u5F85\u56DE\u7B54", waiting_approval: "\u7B49\u5F85\u786E\u8BA4", failed: "\u5931\u8D25", cancelled: "\u5DF2\u505C\u6B62", needs_attention: "\u6267\u884C\u4E2D\u65AD", stale: "\u8F93\u51FA\u5DF2\u8FC7\u671F", skipped: "\u5DF2\u8DF3\u8FC7", pending: "\u5F85\u6267\u884C" };
var pretty = (value) => typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
var prose = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  if (typeof value.material === "string") return value.material;
  return pretty(value);
};
function Content({ value }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives2.MarkdownText, { text: prose(value), labels: { code: { copyLabel: "\u590D\u5236", copiedLabel: "\u5DF2\u590D\u5236" }, footnotes: "\u6CE8\u91CA" } });
}
function RunTimeline({ ctx, api, runId, openSession, onChange, embedded = false, focusNodeId = null, children: children2 }) {
  const [run, setRun] = (0, import_react9.useState)(null), [error, setError] = (0, import_react9.useState)(""), [busy2, setBusy2] = (0, import_react9.useState)(false);
  const [expanded, setExpanded] = (0, import_react9.useState)({}), [recipient, setRecipient] = (0, import_react9.useState)(""), [message, setMessage] = (0, import_react9.useState)("");
  const [confirm, setConfirm] = (0, import_react9.useState)(null), [editing, setEditing] = (0, import_react9.useState)({});
  const lastActive = import_react9.default.useRef("");
  (0, import_react9.useEffect)(() => {
    let stopped = false, timer2;
    const read = async () => {
      try {
        const v = await api({ action: "runRead", id: runId });
        if (!stopped) {
          setRun(v.run);
          setRecipient(v.run.recipient ?? "");
          const active = Object.keys(v.run.nodes).filter((k) => v.run.nodes[k].status === "running").join(",");
          if (active && active !== lastActive.current) {
            setExpanded({});
            lastActive.current = active;
          }
        }
      } catch (e) {
        if (!stopped) setError(e.message);
      }
      if (!stopped) timer2 = setTimeout(read, 1e3);
    };
    setRun(null);
    setExpanded({});
    read();
    return () => {
      stopped = true;
      clearTimeout(timer2);
    };
  }, [runId]);
  const act = async (args) => {
    if (busy2) return;
    setBusy2(true);
    setError("");
    try {
      const result = await api(args);
      const v = await api({ action: "runRead", id: runId });
      setRun(v.run);
      await onChange?.();
      return result;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy2(false);
    }
  };
  const review = async (value) => {
    try {
      const latest = (await api({ action: "runRead", id: runId })).run;
      setRun(latest);
      setConfirm({ ...value, expectedRevision: latest.checkpointRevision });
    } catch (e) {
      setError(e.message);
    }
  };
  (0, import_react9.useEffect)(() => {
    if (!confirm) return;
    const previous = document.activeElement;
    const dialog = document.querySelector(".wf-confirm");
    dialog?.querySelector("button")?.focus();
    const keyboard = (e) => {
      if (e.key === "Escape" && !busy2) {
        e.preventDefault();
        setConfirm(null);
      }
      if (e.key === "Tab") {
        const controls = [...dialog?.querySelectorAll("button:not(:disabled)") ?? []];
        if (!controls.length) return;
        const index2 = controls.indexOf(document.activeElement);
        e.preventDefault();
        controls[(index2 + (e.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [confirm, busy2]);
  if (!run) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("section", { className: "wf wf-timeline", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { role: "status", children: error || "\u6B63\u5728\u8BFB\u53D6\u8FD0\u884C\u2026" }) });
  const running = ["running", "queued"].includes(run.status);
  const resumable = ["paused", "failed", "needs_attention", "cancelled"].includes(run.status);
  const targets = Object.entries(run.nodes).flatMap(([nodeId, n]) => [
    ...n.sessionId ? [{ nodeId, sessionId: n.sessionId, name: n.name, status: n.status }] : [],
    ...Object.entries(n.subagents ?? {}).filter(([, m]) => m.sessionId).map(([memberId, m]) => ({ nodeId, memberId, sessionId: m.sessionId, name: m.name, status: m.status }))
  ]);
  const currentStep = Object.entries(run.nodes).find(([, n]) => n.status === "running")?.[0];
  const resume = (debug) => act({ action: "resume", runId, sessionId: run.sessionId, debug, response: true, background: true, expectedRevision: run.checkpointRevision });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "wf wf-timeline", "aria-label": "\u5DE5\u4F5C\u6D41\u8FD0\u884C\u65F6\u95F4\u7EBF", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("header", { className: "wf-run-header", children: [
      focusNodeId && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u8FD4\u56DE\u5DE5\u4F5C\u6D41\u603B\u4F1A\u8BDD", icon: ArrowLeft, onClick: () => openSession(run.sessionId) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: run.prepared.definition.name }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "wf-run-caption", children: [
          "v",
          run.revision,
          " \xB7 ",
          names[run.status] ?? run.status,
          " \xB7 ",
          run.debug ? "\u9010\u6B65\u8C03\u8BD5" : "\u8FDE\u7EED\u6267\u884C"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "wf-run-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { "aria-label": "\u6B65\u9AA4\u6D88\u606F\u63A5\u6536\u8005", value: recipient, onChange: (e) => {
          setRecipient(e.target.value);
          act({ action: "setRecipient", sessionId: run.sessionId, recipient: e.target.value });
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "", children: "\u5F53\u524D\u6B65\u9AA4" }),
          targets.map((t) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: t.sessionId, children: t.name }, t.sessionId))
        ] }),
        running && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u6682\u505C", icon: Pause, disabled: busy2, onClick: () => act({ action: "pause", id: runId }) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u505C\u6B62", icon: Square, disabled: busy2, onClick: () => act({ action: "cancel", id: runId }) })
        ] }),
        resumable && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u8FD0\u884C\u4E00\u6B65", icon: StepForward, disabled: busy2, onClick: () => resume(true) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u8FDE\u7EED\u6267\u884C", icon: Play, disabled: busy2, onClick: () => resume(false) })
        ] }),
        !embedded && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { onClick: () => openSession(run.sessionId), children: "\u6253\u5F00\u603B\u4F1A\u8BDD" })
      ] })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "wf-error", role: "alert", children: error }),
    run.error && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "wf-error", children: run.error }),
    run.prepared.definition.nodes.map((node, index2) => {
      if (focusNodeId && focusNodeId !== node.id) return null;
      const state = run.nodes[node.id] ?? { status: "pending" };
      const active = state.status === "running";
      const show = expanded[node.id] ?? (active || node.id === currentStep);
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("article", { className: `wf-run-step ${active ? "is-running" : ""}`, "data-step-id": node.id, style: { "--wf-cell-hue": [218, 150, 35, 278, 185, 340][index2 % 6] }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("header", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "wf-step-number", children: [
            "\u6B65\u9AA4 ",
            index2 + 1
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: node.name }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "wf-step-state", children: [
            active ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(LoaderCircle, { size: 13, className: "wf-spin" }) : state.status === "completed" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Check, { size: 13 }) : null,
            names[state.status]
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "wf-model-line", children: [
          "\u6A21\u578B\uFF1A",
          state.route ? `${state.route.provider} / ${state.route.model}${state.route.reasoningEffort ? " \xB7 " + state.route.reasoningEffort : ""}` : node.kind === "agent" ? "\u6267\u884C\u65F6\u786E\u5B9A" : "\u6D41\u7A0B\u6B65\u9AA4"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "wf-cell-toolbar", role: "toolbar", "aria-label": `${node.name}\u64CD\u4F5C`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u8FD0\u884C\u6B64\u6B65\u9AA4", icon: Play, disabled: busy2 || running || Boolean(editing[node.id]), onClick: () => act({ action: "stepRun", runId, nodeId: node.id, expectedRevision: run.checkpointRevision }) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u7F16\u8F91\u8F93\u5165", icon: Pencil, disabled: busy2 || running, onClick: () => setEditing((v) => ({ ...v, [node.id]: !v[node.id] })) }),
          (state.sessionId || state.status === "completed") && !focusNodeId && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u6253\u5F00\u6B65\u9AA4\u4F1A\u8BDD", icon: ExternalLink, disabled: busy2, onClick: () => act({ action: "stepOpen", runId, nodeId: node.id }).then((result) => result && openSession(result.sessionId)) }),
          state.status === "completed" && !running && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u66F4\u65B0\u6B65\u9AA4\u8F93\u51FA", icon: CheckCheck, disabled: busy2 || !state.sessionId, onClick: () => review({ action: "adopt", nodeId: node.id, label: "\u66F4\u65B0\u6B65\u9AA4\u8F93\u51FA", description: "\u5C06\u6700\u65B0\u56DE\u7B54\u4FDD\u5B58\u4E3A\u6B65\u9AA4\u8F93\u51FA\uFF0C\u5E76\u56DE\u9000\u4F9D\u8D56\u6B65\u9AA4\u7684\u6587\u4EF6\u6539\u52A8\u3002" }) }),
          state.status === "completed" && !running && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconButton, { label: "\u51C6\u5907\u540E\u7EED\u6B65\u9AA4", icon: SkipForward, disabled: busy2, onClick: () => review({ action: "rewind", nodeId: node.id, include: false, label: "\u51C6\u5907\u540E\u7EED\u6B65\u9AA4", description: "\u4FDD\u7559\u672C\u6B65\u9AA4\uFF0C\u56DE\u9000\u4F9D\u8D56\u6B65\u9AA4\u7684\u6587\u4EF6\u6539\u52A8\u3002" }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(StepInput, { api, run, node, state, busy: busy2, act, editing: Boolean(editing[node.id]), setEditing: (value) => setEditing((v) => ({ ...v, [node.id]: value })) }),
        !focusNodeId && (state.sessionId || Object.keys(state.subagents ?? {}).length > 0) && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "wf-activity-toggle", "aria-label": show ? "\u6536\u8D77\u8FC7\u7A0B" : "\u5C55\u5F00\u8FC7\u7A0B", "aria-expanded": show, onClick: () => setExpanded((v) => ({ ...v, [node.id]: !show })), children: [
          show ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ChevronDown, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ChevronRight, { size: 14 }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
            "\u6267\u884C\u8FC7\u7A0B",
            Object.keys(state.subagents ?? {}).length ? ` \xB7 ${Object.keys(state.subagents).length} \u4E2A\u5B50\u4EE3\u7406` : ""
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "wf-cell-process", children: [
          state.interaction?.question && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("aside", { className: "wf-interaction", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u7B49\u5F85\u4F60\u7684\u56DE\u7B54" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: state.interaction.question }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { onClick: () => openSession(run.sessionId), children: "\u53BB\u603B\u4F1A\u8BDD\u56DE\u7B54" })
          ] }),
          !focusNodeId && show && Object.entries(state.subagents ?? {}).map(([memberId, m]) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "wf-team-member", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: m.name }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
              names[m.status],
              " \xB7 ",
              m.route?.provider,
              " / ",
              m.route?.model
            ] }),
            m.sessionId && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { onClick: () => act({ action: "stepOpen", runId, nodeId: node.id, memberId }).then((ok) => ok && openSession(m.sessionId)), children: "\u6253\u5F00\u5B50\u4EE3\u7406\u4F1A\u8BDD" }),
            show && m.sessionId && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(NativeStep, { ctx, parentSessionId: run.sessionId, sessionId: m.sessionId })
          ] }, memberId)),
          !focusNodeId && show && state.sessionId && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(NativeStep, { ctx, parentSessionId: run.sessionId, sessionId: state.sessionId }),
          !focusNodeId && show && !state.sessionId && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "wf-muted", children: "\u6B64\u6B65\u9AA4\u7684\u6267\u884C\u4FE1\u606F\u8BB0\u5F55\u5728\u8F93\u5165\u3001\u8F93\u51FA\u53CA\u68C0\u67E5\u70B9\u4E2D\u3002" })
        ] }),
        focusNodeId && children2,
        state.output && !focusNodeId && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "wf-step-answer", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: "\u8F93\u51FA" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Content, { value: state.output })
        ] }),
        !!run.reviews?.[node.id]?.length && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("details", { className: "wf-review-history", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("summary", { children: [
            "\u8BC4\u5BA1\u8BB0\u5F55 \xB7 ",
            run.reviews[node.id].length,
            " \u8F6E"
          ] }),
          run.reviews[node.id].map((r) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
              "\u7B2C ",
              r.round,
              " \u8F6E \xB7 ",
              r.accepted ? "\u901A\u8FC7" : "\u9700\u8981\u4FEE\u8BA2"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Content, { value: r.output })
          ] }, r.round))
        ] }),
        state.status === "needs_attention" && node.repeat && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { role: "status", children: [
          "\u5DF2\u8FBE\u5230 ",
          node.repeat.maxRounds,
          " \u8F6E\u8BC4\u5BA1\u4E0A\u9650\u3002\u8BF7\u68C0\u67E5\u8BC4\u5BA1\u8BB0\u5F55\uFF0C\u4FEE\u6539\u8F93\u5165\u540E\u901A\u8FC7\u6B65\u9AA4\u8FD0\u884C\u6309\u94AE\u5F00\u59CB\u65B0\u4E00\u8F6E\u3002"
        ] }),
        state.status === "stale" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "wf-muted", children: "\u8F93\u51FA\u5DF2\u8FC7\u671F\uFF0C\u7B49\u5F85\u91CD\u8DD1\u3002" }),
        !!state.output?.attachments?.length && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "wf-file-row", children: state.output.attachments.map((block) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FileCard, { api, runId: run.id, block }, block.attachment.attachmentId)) }),
        !!state.attempts?.length && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("details", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("summary", { children: [
            "\u6587\u4EF6\u4E0E\u5C1D\u8BD5\u8BB0\u5F55 \xB7 ",
            state.attempts.length
          ] }),
          state.attempts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
              "\u5C1D\u8BD5 ",
              a.index,
              " \xB7 ",
              a.status,
              a.reverted ? " \xB7 \u5DF2\u56DE\u9000" : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "wf-path", children: a.folder }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("pre", { children: pretty(a.checkpoint?.changes ?? []) })
          ] }, a.index))
        ] })
      ] }, node.id);
    }),
    !embedded && !!targets.length && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("form", { className: "wf-run-composer", onSubmit: (e) => {
      e.preventDefault();
      const selected2 = targets.find((t) => t.sessionId === recipient) ?? targets.find((t) => t.status === "running") ?? targets.at(-1);
      act({ action: "stepMessage", runId, nodeId: selected2.nodeId, memberId: selected2.memberId, text: message }).then((ok) => ok && setMessage(""));
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("textarea", { "aria-label": "\u4E0E\u6B65\u9AA4\u4EA4\u6D41", value: message, onChange: (e) => setMessage(e.target.value), placeholder: "\u8865\u5145\u8981\u6C42\u3001\u63D0\u95EE\u6216\u68C0\u89C6\u7ED3\u679C\u2026" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { disabled: busy2 || !message.trim(), type: "submit", children: "\u53D1\u9001" })
    ] }),
    confirm && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "wf-confirm", role: "dialog", "aria-modal": "true", "aria-label": confirm.label, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: confirm.label }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: confirm.description }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { disabled: busy2, onClick: async () => {
        const ok = await act({ ...confirm, label: void 0, description: void 0, runId, expectedRevision: confirm.expectedRevision });
        if (ok) setConfirm(null);
      }, children: "\u786E\u8BA4" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { onClick: () => setConfirm(null), children: "\u53D6\u6D88" })
    ] })
  ] });
}

// client/step-prompt.jsx
var import_react10 = __toESM(require("react"), 1);
var import_jsx_runtime7 = require("react/jsx-runtime");
function serialize(root2) {
  const read = (node) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.dataset?.reference) return `{{input.${node.dataset.reference}}}`;
    if (node.nodeName === "BR") return "\n";
    const text = [...node.childNodes].map(read).join("");
    return ["DIV", "P"].includes(node.nodeName) && node !== root2 ? text + "\n" : text;
  };
  return read(root2).replace(/\n$/, "");
}
function StepPrompt({ node, definition, onChange, onReference }) {
  const editor = (0, import_react10.useRef)(null);
  const last = (0, import_react10.useRef)();
  const [picker, setPicker] = (0, import_react10.useState)(false);
  const [query, setQuery] = (0, import_react10.useState)("");
  (0, import_react10.useLayoutEffect)(() => {
    const value = node.prompt ?? "";
    if (last.current === value) return;
    const root2 = editor.current;
    root2.replaceChildren();
    const parts = value.split(/(\{\{input\.[a-zA-Z0-9_-]+\}\})/g);
    for (const part of parts) {
      const key = /^\{\{input\.([a-zA-Z0-9_-]+)\}\}$/.exec(part)?.[1];
      if (!key) {
        root2.append(document.createTextNode(part));
        continue;
      }
      const ref = node.input?.[key];
      const source = definition.nodes.find((n) => n.id === ref?.nodeId);
      const chip = document.createElement("span");
      chip.contentEditable = "false";
      chip.dataset.reference = key;
      chip.className = `wf-inline-reference wf-step-${source?.kind ?? "input"}`;
      chip.textContent = source?.name ?? (ref?.source === "workflow" ? "\u7528\u6237\u6750\u6599" : key);
      chip.title = "\u5F15\u7528\u6B64\u6B65\u9AA4\u7684\u7ED3\u679C";
      root2.append(chip);
    }
    last.current = value;
  }, [node.prompt, node.input, definition.nodes]);
  const sync = () => {
    const text = serialize(editor.current);
    last.current = text;
    onChange(text);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "wf-prompt-composer", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        ref: editor,
        contentEditable: true,
        suppressContentEditableWarning: true,
        role: "textbox",
        "aria-label": "\u6B65\u9AA4\u8BF4\u660E",
        "aria-multiline": "true",
        className: "wf-step-prompt",
        "data-placeholder": "\u63CF\u8FF0\u4EFB\u52A1\uFF1B\u9700\u8981\u534F\u4F5C\u65F6\u5199\u660E\u201C\u4F7F\u7528 subagents\u201D\u53CA\u5404\u81EA\u804C\u8D23\u2026",
        onInput: sync,
        onKeyDown: (e) => {
          e.stopPropagation();
          if (e.key === "@") {
            e.preventDefault();
            setPicker(true);
          }
        },
        onPaste: (e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          const selection2 = window.getSelection();
          if (!selection2?.rangeCount) return;
          const range = selection2.getRangeAt(0);
          range.deleteContents();
          const inserted = document.createTextNode(text);
          range.insertNode(inserted);
          range.setStartAfter(inserted);
          range.collapse(true);
          selection2.removeAllRanges();
          selection2.addRange(range);
          sync();
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "wf-add-reference", "aria-expanded": picker, onClick: () => setPicker((v) => !v), children: "\uFF20 \u6DFB\u52A0\u6B65\u9AA4\u7ED3\u679C" }),
    picker && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "wf-reference-picker", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "wf-muted", children: "\u5C06\u6240\u9009\u6B65\u9AA4\u7684\u8F93\u51FA\u4F5C\u4E3A\u672C\u6B65\u8F93\u5165\uFF0C\u5E76\u7B49\u5F85\u5B83\u5B8C\u6210\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { "aria-label": "\u641C\u7D22\u53EF\u5F15\u7528\u6B65\u9AA4", placeholder: "\u641C\u7D22\u6B65\u9AA4", value: query, onChange: (e) => setQuery(e.target.value) }),
      definition.nodes.filter((n) => canConnect(definition, n.id, node.id) && n.name.includes(query)).map((source) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: `wf-step-${source.kind}`, onClick: () => {
        onReference(source.id);
        setPicker(false);
        setQuery("");
      }, children: source.name }, source.id))
    ] })
  ] });
}

// client/index.jsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var name = "dsh-plugin-workflow";
var inject = [
  "slots",
  "layout",
  "sessions",
  "commandUi",
  "workspaces",
  "uiWorkspace"
];
var labels = {
  input: "\u7528\u6237\u8F93\u5165",
  interact: "\u4EA4\u4E92",
  agent: "\u751F\u6210",
  tool: "\u5DE5\u5177",
  condition: "\u6761\u4EF6",
  join: "\u6C47\u5408",
  loop: "\u5FAA\u73AF",
  subworkflow: "\u5B50\u5DE5\u4F5C\u6D41",
  approval: "\u786E\u8BA4",
  artifact: "\u8F93\u51FA",
  publish: "\u53D1\u5E03"
};
var statuses = {
  queued: "\u7B49\u5F85\u6267\u884C",
  running: "\u6267\u884C\u4E2D",
  completed: "\u5DF2\u5B8C\u6210",
  failed: "\u5931\u8D25",
  cancelled: "\u5DF2\u53D6\u6D88",
  paused: "\u5DF2\u6682\u505C",
  waiting_approval: "\u7B49\u5F85\u786E\u8BA4",
  waiting_input: "\u7B49\u5F85\u8F93\u5165",
  needs_attention: "\u9700\u8981\u5904\u7406",
  skipped: "\u5DF2\u8DF3\u8FC7",
  pending: "\u5F85\u6267\u884C",
  stale: "\u8F93\u51FA\u5DF2\u8FC7\u671F"
};
var glyphs = {
  workflow: GitBranch,
  book: BookOpen,
  search: Search,
  code: Code,
  file: FileText,
  sparkles: Sparkles,
  input: TextCursorInput,
  interact: MessageSquare,
  agent: Sparkles,
  tool: Settings2,
  condition: GitBranch,
  join: PanelsTopLeft,
  loop: RefreshCw,
  subworkflow: GitBranch,
  approval: Check,
  artifact: FileText,
  publish: Send
};
var glyphFor = (glyph, size) => {
  const Glyph = glyphs[glyph] ?? GitBranch;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Glyph, { size });
};
var pretty2 = (value) => JSON.stringify(value, null, 2);
var timestamp = (time) => time ? new Date(time).toLocaleString() : "-";
var download = (name2, content, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name2;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
};
function Icon2({ label, icon: Symbol2, className, size = 16, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "button",
    {
      type: "button",
      className: `wf-icon${className ? ` ${className}` : ""}`,
      title: label,
      "aria-label": label,
      ...props,
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Symbol2, { size })
    }
  );
}
function Field({ label, children: children2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-field", role: "group", "aria-label": label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: label }),
    import_react11.default.Children.map(children2, (child) => import_react11.default.isValidElement(child) && ["input", "textarea", "select"].includes(child.type) ? import_react11.default.cloneElement(child, { "aria-label": child.props["aria-label"] ?? label }) : child)
  ] });
}
function JsonField({ label, value, change, rows = 5 }) {
  const [text, setText] = (0, import_react11.useState)(pretty2(value ?? {}));
  const [error, setError] = (0, import_react11.useState)("");
  const last = import_react11.default.useRef(pretty2(value ?? {}));
  (0, import_react11.useEffect)(() => {
    const next = pretty2(value ?? {});
    if (next !== last.current) {
      last.current = next;
      setText(next);
      setError("");
    }
  }, [value]);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Field, { label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "textarea",
      {
        rows,
        value: text,
        "aria-invalid": Boolean(error),
        spellCheck: false,
        onChange: (e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            last.current = pretty2(parsed);
            change(parsed);
            setError("");
          } catch {
            setError("JSON \u683C\u5F0F\u4E0D\u5B8C\u6574");
          }
        }
      }
    ),
    error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("small", { role: "alert", children: error })
  ] });
}
function Modal({ title, close, children: children2 }) {
  const ref = import_react11.default.useRef();
  (0, import_react11.useEffect)(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("dialog", { className: "wf-modal wf", ref, onCancel: close, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("header", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon2, { label: "\u5173\u95ED", icon: X, onClick: close })
    ] }),
    children2
  ] });
}
function apply(ctx) {
  let snapshot = {
    workflows: [],
    references: [],
    bindings: [],
    authoring: [],
    runs: [],
    schedules: [],
    error: ""
  };
  const listeners = /* @__PURE__ */ new Set();
  const panelOpenKey = "workflow-studio:panel-open";
  let panelOpen = (() => {
    try {
      return localStorage.getItem(panelOpenKey) === "true";
    } catch {
      return false;
    }
  })();
  let panel = { id: null, tab: "graph" };
  const panelListeners = /* @__PURE__ */ new Set();
  let picker = null;
  const pickerListeners = /* @__PURE__ */ new Set();
  let stopped = false;
  let sidebarWide = true;
  const drafts = /* @__PURE__ */ new Map();
  const fitNarrowPanel = () => {
    if (window.innerWidth < 700 && sidebarWide) ctx.layout.toggleSidebar();
  };
  const api = async (args, signal) => {
    if (["save", "run", "scheduleSave"].includes(args.action) && document.querySelector('.wf textarea[aria-invalid="true"]'))
      throw new Error("\u8BF7\u5148\u4FEE\u6B63 JSON \u683C\u5F0F");
    const response = await fetch("/api/workflow-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.detail ?? result.error);
    return result.value;
  };
  let refreshing;
  const lifetime = new AbortController();
  const publish = (next) => {
    if (stopped || JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next;
    listeners.forEach((f) => f());
  };
  const syncSessions = (data) => {
    const known = ctx.sessions.list.getSnapshot().byId;
    const referenced = /* @__PURE__ */ new Set([
      ...data.references.map((item) => item.sessionId),
      ...data.bindings.map((item) => item.sessionId),
      ...data.runs.map((item) => item.sessionId),
      ...(data.stepSessions ?? []).map((item) => item.sessionId)
    ]);
    if ([...referenced].some((id2) => id2 && !known[id2])) void ctx.sessions.refresh();
  };
  const refresh = () => {
    if (stopped) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = api({ action: "state" }, AbortSignal.any([
      lifetime.signal,
      AbortSignal.timeout(15e3)
    ])).then((data) => {
      publish({ ...data, error: "" });
      syncSessions(data);
    }).catch((e) => publish({ ...snapshot, error: e.message })).finally(() => {
      refreshing = void 0;
    });
    return refreshing;
  };
  const useData = () => (0, import_react11.useSyncExternalStore)(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => snapshot
  );
  const useSessions = () => (0, import_react11.useSyncExternalStore)(
    ctx.sessions.list.subscribe,
    ctx.sessions.list.getSnapshot
  );
  const usePanel = () => (0, import_react11.useSyncExternalStore)(
    (fn) => {
      panelListeners.add(fn);
      return () => panelListeners.delete(fn);
    },
    () => panel
  );
  const setPanelOpen = (value) => {
    if (panelOpen === value) return;
    panelOpen = value;
    try {
      localStorage.setItem(panelOpenKey, String(value));
    } catch {
    }
    panelListeners.forEach((f) => f());
  };
  const openEditor = (id2, tab = "graph") => {
    void refresh();
    panel = { id: id2, tab };
    setPanelOpen(true);
    panelListeners.forEach((f) => f());
    ctx.layout.selectPanel("workflow-studio");
    fitNarrowPanel();
  };
  const openPicker = (sessionId) => {
    picker = { sessionId };
    pickerListeners.forEach((f) => f());
  };
  const closePicker = () => {
    picker = null;
    pickerListeners.forEach((f) => f());
  };
  const current = () => ctx.sessions.list.getSnapshot().current;
  const ensureWorkflowWorkspace = async (segment, title) => {
    const { path } = await api({ action: "workflowWorkspace", segment });
    if (!window.__dshWorkflowWorkspacePaths) window.__dshWorkflowWorkspacePaths = /* @__PURE__ */ new Set();
    window.__dshWorkflowWorkspacePaths.add(path);
    const existing = ctx.workspaces.list.getSnapshot().items.find((w) => w.path === path);
    if (existing) {
      if (title && existing.title === segment) {
        try {
          return await ctx.uiWorkspace.workspaces.rename(existing.workspaceId, title);
        } catch {
          return existing;
        }
      }
      return existing;
    }
    const workspace = await ctx.uiWorkspace.workspaces.create({ path });
    if (!title) return workspace;
    try {
      return await ctx.uiWorkspace.workspaces.rename(workspace.workspaceId, title);
    } catch {
      return workspace;
    }
  };
  const newSession = async (workspaceId) => {
    const state = ctx.sessions.list.getSnapshot();
    const source = state.byId[state.current];
    if (workspaceId) return ctx.sessions.create({ workspaceId });
    return ctx.sessions.create(source?.cwd ? { cwd: source.cwd } : {});
  };
  const sessionFor = async (id2, timeoutMs = 8e3) => {
    const deadline = Date.now() + timeoutMs;
    for (; ; ) {
      const session = ctx.sessions.binding(id2)?.session;
      if (session) return session;
      if (Date.now() > deadline) throw new Error("\u4F1A\u8BDD\u5C1A\u672A\u5C31\u7EEA");
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  };
  const send = async (id2, text, mode = "queue") => {
    const session = await sessionFor(id2);
    const result = await session.prompt([{ type: "text", text }], mode);
    if (result && result.ok === false)
      throw new Error(result.error?.message ?? "\u4F1A\u8BDD\u62D2\u7EDD\u4E86\u672C\u6B21\u8F93\u5165");
    return id2;
  };
  const openSession = (id2) => {
    ctx.uiWorkspace.openSession(id2);
    setPanelOpen(false);
    closePicker();
  };
  const bindSession = async (wf, sessionId, mode = "run", revision) => {
    const workspace = sessionId ? null : mode === "run" ? await ensureWorkflowWorkspace(wf.id, wf.name) : await ensureWorkflowWorkspace("tmp", "\u5DE5\u4F5C\u6D41\u5BF9\u8BDD");
    const id2 = sessionId ?? await newSession(workspace?.workspaceId);
    await api({
      action: "bind",
      sessionId: id2,
      id: wf.id,
      revision: revision ?? (mode === "author" ? wf.revision : wf.published ?? wf.revision),
      mode
    });
    await ctx.sessions.refresh();
    await refresh();
    return id2;
  };
  const bind = async (wf, sessionId, mode = "run", revision) => {
    const id2 = await bindSession(wf, sessionId, mode, revision);
    openSession(id2);
    return id2;
  };
  const beginAuthorSession = async (sessionId) => {
    const tmp = await ensureWorkflowWorkspace("tmp", "\u5DE5\u4F5C\u6D41\u5BF9\u8BDD");
    const id2 = sessionId ?? await newSession(tmp.workspaceId);
    await api({ action: "authorStart", sessionId: id2 });
    await ctx.sessions.refresh();
    ctx.sessions.open(id2);
    ctx.layout.selectPanel(null);
    setPanelOpen(false);
    closePicker();
    await send(id2, "\u6211\u60F3\u521B\u5EFA\u4E00\u4E2A\u65B0\u7684\u5DE5\u4F5C\u6D41\u3002");
    await refresh();
    return id2;
  };
  const unbind = async (sessionId) => {
    await api({ action: "unbind", sessionId });
    await refresh();
  };
  let headerDraft = { key: null, definition: null, dirty: false, rename: null, save: null };
  const headerListeners = /* @__PURE__ */ new Set();
  const setHeaderDraft = (next) => {
    headerDraft = next;
    headerListeners.forEach((listener) => listener());
  };
  const useHeaderDraft = () => (0, import_react11.useSyncExternalStore)(
    (fn) => {
      headerListeners.add(fn);
      return () => headerListeners.delete(fn);
    },
    () => headerDraft
  );
  const Gallery = createGallery({ ctx, api, refresh, openSession, openEditor, bind, beginAuthorSession, useSessions, Icon: Icon2, glyphFor, timestamp });
  function Tree({ wide = true, usePanelInfo }) {
    const data = useData();
    const fallback = (0, import_react11.useSyncExternalStore)(
      (fn) => {
        panelListeners.add(fn);
        return () => panelListeners.delete(fn);
      },
      () => panelOpen
    );
    const active = typeof usePanelInfo === "function" ? usePanelInfo((info) => info.activePanelId === "workflow-studio") : fallback;
    const count = data.workflows.filter((w) => !w.archived).length;
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf wf-tree", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "button",
      {
        type: "button",
        className: `wf-nav-button${active ? " is-active" : ""}${wide ? "" : " is-rail"}`,
        "aria-expanded": active,
        "aria-current": active ? "page" : void 0,
        "aria-label": "\u5DE5\u4F5C\u6D41",
        title: "\u5DE5\u4F5C\u6D41",
        onClick: () => {
          if (active) {
            ctx.layout.selectPanel(null);
            setPanelOpen(false);
          } else {
            openEditor(null);
          }
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GitBranch, { size: 16, strokeWidth: 1.8, "aria-hidden": "true" }),
          wide && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "\u5DE5\u4F5C\u6D41" }),
          wide && count > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-nav-count", children: count })
        ]
      }
    ) });
  }
  function Picker() {
    const value = (0, import_react11.useSyncExternalStore)(
      (fn) => {
        pickerListeners.add(fn);
        return () => pickerListeners.delete(fn);
      },
      () => picker
    );
    const data = useData();
    const [query, setQuery] = (0, import_react11.useState)("");
    const [busy2, setBusy2] = (0, import_react11.useState)(false);
    const [error, setError] = (0, import_react11.useState)("");
    (0, import_react11.useEffect)(() => {
      setError("");
      setQuery("");
    }, [value]);
    if (!value) return null;
    const act = async (fn) => {
      setBusy2(true);
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy2(false);
      }
    };
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Modal, { title: "\u9009\u62E9\u5DE5\u4F5C\u6D41", close: closePicker, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-modal-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-search", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Search, { size: 16 }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              "aria-label": "\u641C\u7D22\u5DE5\u4F5C\u6D41",
              value: query,
              onChange: (e) => setQuery(e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-picker-list", children: data.workflows.filter((w) => !w.archived && w.name.includes(query)).map((w) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            disabled: busy2,
            onClick: () => act(() => bind(w, value.sessionId)),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GitBranch, { size: 18 }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: w.name }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("small", { children: w.description })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
                "v",
                w.published ?? w.revision
              ] })
            ]
          },
          w.id
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { onClick: () => act(() => beginAuthorSession(value.sessionId)), children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Plus, { size: 16 }),
          "\u521B\u5EFA\u5DE5\u4F5C\u6D41"
        ] })
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-error", role: "alert", children: error })
    ] }) });
  }
  function Routing({ node, update, caps }) {
    const [info, setInfo] = (0, import_react11.useState)(null);
    const provider = node.provider?.mode === "explicit" ? node.provider.id : "";
    const model = node.model?.mode === "explicit" ? node.model.id : "";
    (0, import_react11.useEffect)(() => {
      let live = true;
      setInfo(null);
      if (provider && model)
        api({ action: "modelInfo", provider, model }).then((v) => {
          if (live) setInfo(v);
        }).catch(() => {
        });
      return () => {
        live = false;
      };
    }, [provider, model]);
    const providers = caps?.providers ?? [];
    const models = providers.find((p) => p.id === provider)?.models ?? [];
    const route = (field, value) => update({
      [field]: value ? { mode: "explicit", id: value } : { mode: "inherit" }
    });
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "Executor", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "select",
        {
          value: node.executor ?? "spawn",
          onChange: (e) => update({ executor: e.target.value }),
          children: (caps?.executors ?? ["spawn"]).map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { children: p }, p))
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "Provider", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "select",
        {
          value: provider,
          onChange: (e) => {
            route("provider", e.target.value);
            update({
              provider: e.target.value ? { mode: "explicit", id: e.target.value } : { mode: "inherit" },
              model: { mode: "inherit" },
              effort: { mode: "inherit" }
            });
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "", children: "\u7EE7\u627F\u4F1A\u8BDD" }),
            providers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: p.id, children: p.name }, p.id))
          ]
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Field, { label: "Model", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            list: "wf-models",
            value: model,
            placeholder: "\u7EE7\u627F\u4F1A\u8BDD",
            onChange: (e) => route("model", e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("datalist", { id: "wf-models", children: models.map((m) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: m.id, children: m.name }, m.id)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Field, { label: "\u63A8\u7406\u5F3A\u5EA6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            list: "wf-efforts",
            value: node.effort?.mode === "explicit" ? node.effort.id : "",
            placeholder: "\u7EE7\u627F\u4F1A\u8BDD",
            onChange: (e) => route("effort", e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("datalist", { id: "wf-efforts", children: info?.reasoning?.efforts.map((e) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: e.id, children: e.name }, e.id)) })
      ] })
    ] });
  }
  const nodeTypes = {
    workflowNode: ({ data: view, selected: active }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: `wf-node-card wf-step-${view.kind} ${active ? "is-selected" : ""}`, children: [
      view.kind !== "input" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Handle, { type: "target", position: Position.Top }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-step-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-step-glyph", children: glyphFor(view.kind, 14) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-node-order", children: view.order }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: view.title }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { children: labels[view.kind] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-step-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: view.summary }),
        view.references.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-step-references", children: view.references.map((ref, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `wf-inline-reference wf-step-${ref.kind}`, children: ref.name }, `${ref.id}-${i}`)) }),
        view.kind === "agent" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-step-model", children: view.model }),
        view.repeat && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "wf-step-model", children: [
          "\u672A\u901A\u8FC7\u8FD4\u56DE\u4FEE\u8BA2 \xB7 \u6700\u591A ",
          view.repeat.maxRounds,
          " \u8F6E"
        ] }),
        view.kind === "interact" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-step-model", children: view.mode })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Handle, { type: "source", position: Position.Bottom }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Handle, { id: "retry-in", type: "target", position: Position.Right, isConnectable: false }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Handle, { id: "retry-out", type: "source", position: Position.Right, isConnectable: false })
    ] })
  };
  function Editor({ record, caps, save }) {
    const data = useData();
    const draftKey = `${record.id}:${record.revision}`;
    const [definition, setDefinition] = (0, import_react11.useState)(drafts.get(draftKey) ?? record.snapshot.definition);
    const [selected2, setSelected] = (0, import_react11.useState)(definition.nodes[0]?.id);
    const [dirty, setDirty] = (0, import_react11.useState)(drafts.has(draftKey));
    const [panelTab, setPanelTab] = (0, import_react11.useState)("step");
    const [raw, setRaw] = (0, import_react11.useState)(false);
    const [editorView, setEditorView] = (0, import_react11.useState)(() => localStorage.getItem("workflow-studio:editor-view") || "steps");
    const [error, setError] = (0, import_react11.useState)("");
    const [history, setHistory] = (0, import_react11.useState)([]);
    const [clipboard, setClipboard] = (0, import_react11.useState)(null);
    const [run, setRun] = (0, import_react11.useState)(null);
    const [assetsOpen, setAssetsOpen] = (0, import_react11.useState)(false);
    const [notice, setNotice] = (0, import_react11.useState)("");
    const [skillEdit, setSkillEdit] = (0, import_react11.useState)(null);
    const [selectedEdge, setSelectedEdge] = (0, import_react11.useState)(null);
    const flow = import_react11.default.useRef();
    const flowElement = import_react11.default.useRef();
    const importInput = import_react11.default.useRef();
    (0, import_react11.useEffect)(() => {
      if (!flowElement.current) return;
      let frame2;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame2);
        frame2 = requestAnimationFrame(() => flow.current?.fitView({ padding: 0.18, duration: 0 }));
      });
      observer.observe(flowElement.current);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame2);
      };
    }, [raw, editorView]);
    (0, import_react11.useEffect)(() => {
      setDefinition(drafts.get(draftKey) ?? record.snapshot.definition);
      setDirty(drafts.has(draftKey));
    }, [record]);
    (0, import_react11.useEffect)(() => {
      const fn = (e) => {
        if (dirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      };
      window.addEventListener("beforeunload", fn);
      return () => window.removeEventListener("beforeunload", fn);
    }, [dirty]);
    const change = (value) => {
      drafts.set(draftKey, value);
      setHistory((old) => [...old.slice(-29), definition]);
      setDefinition(value);
      setDirty(true);
    };
    (0, import_react11.useEffect)(() => {
      setHeaderDraft({
        key: draftKey,
        definition,
        dirty,
        rename: (name2) => change({ ...definition, name: name2 }),
        save: () => save(definition, record.revision)
      });
    }, [definition, dirty, draftKey]);
    (0, import_react11.useEffect)(
      () => () => setHeaderDraft({ key: null, definition: null, dirty: false }),
      []
    );
    const node = definition.nodes.find((n) => n.id === selected2);
    (0, import_react11.useEffect)(() => {
      const onKey = (e) => {
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && node) {
          e.preventDefault();
          setClipboard({ ...node, id: `node_${crypto.randomUUID().slice(0, 8)}`, name: `${node.name} \u526F\u672C` });
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && clipboard) {
          e.preventDefault();
          const pasted = { ...clipboard, position: { x: (clipboard.position?.x ?? 100) + 40, y: (clipboard.position?.y ?? 100) + 40 } };
          change({ ...definition, nodes: [...definition.nodes, pasted] });
          setSelected(pasted.id);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [node, clipboard, definition]);
    const update = (patch) => change({
      ...definition,
      nodes: definition.nodes.map(
        (n) => n.id === selected2 ? { ...n, ...patch } : n
      )
    });
    const add = (kind, position) => {
      const id2 = `node_${crypto.randomUUID().slice(0, 8)}`;
      const n = {
        id: id2,
        name: labels[kind],
        kind,
        position: position ?? {
          x: 100 + definition.nodes.length % 3 * 400,
          y: 100 + Math.floor(definition.nodes.length / 3) * 300
        }
      };
      if (kind === "agent") {
        n.prompt = "\u6839\u636E\u8F93\u5165\u5B8C\u6210\u6B64\u6B65\u9AA4\uFF0C\u8FD4\u56DE\u5B8C\u6574\u7ED3\u679C\u3002";
        n.input = { material: { source: "workflow", path: "/text" } };
        n.tools = [];
        n.skills = [];
      }
      if (kind === "input") {
        n.prompt = "\u8BF7\u63D0\u4F9B\u672C\u6B21\u4EFB\u52A1\u9700\u8981\u7684\u6750\u6599\u3002";
        n.input = { text: { source: "workflow", path: "/text" } };
      }
      if (kind === "interact") {
        n.interaction = "once";
        n.prompt = "\u8BF7\u63D0\u4F9B\u5B8C\u6210\u4EFB\u52A1\u9700\u8981\u7684\u6750\u6599\u3002";
        n.input = { material: { source: "workflow", path: "/text" } };
      }
      if (kind === "condition") n.condition = { "!!": [{ var: "value" }] };
      if (kind === "artifact") {
        n.format = "text/markdown";
        n.input = { content: { source: "workflow", path: "/text" } };
      }
      change({ ...definition, nodes: [...definition.nodes, n] });
      setSelected(id2);
    };
    const remove2 = (id2 = selected2) => {
      const index2 = definition.nodes.findIndex((n) => n.id === id2);
      if (index2 < 0) return;
      try {
        const next = removeGraphItems(definition, [id2]);
        change(next);
        setSelected(next.nodes[Math.min(index2, next.nodes.length - 1)]?.id ?? null);
        setNotice(`\u5DF2\u5220\u9664\u201C${definition.nodes[index2].name}\u201D\uFF0C\u53EF\u64A4\u9500\u6062\u590D\u3002`);
      } catch (e) {
        setError(e.message);
      }
    };
    const undo = () => {
      if (!history.length) return;
      const previous = history.at(-1);
      drafts.set(draftKey, previous);
      setDefinition(previous);
      setHistory((h) => h.slice(0, -1));
      setSelected(previous.nodes.some((n) => n.id === selected2) ? selected2 : previous.nodes.at(-1)?.id ?? null);
      setDirty(true);
      setNotice("\u5DF2\u64A4\u9500\uFF0C\u6B65\u9AA4\u4E0E\u6750\u6599\u5173\u7CFB\u5DF2\u6062\u590D\u3002");
    };
    (0, import_react11.useEffect)(() => {
      const keydown = (e) => {
        if (!e.target.closest(".wf-editor") || e.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
        if (e.key === "Delete" || e.key === "Backspace") {
          if (selectedEdge && !selectedEdge.startsWith("repeat:")) {
            e.preventDefault();
            change(removeGraphItems(definition, [], [selectedEdge]));
            setSelectedEdge(null);
            setNotice("\u5DF2\u5220\u9664\u8FDE\u63A5\uFF0C\u53EF\u64A4\u9500\u6062\u590D\u3002");
          } else if (selected2) {
            e.preventDefault();
            remove2();
          }
        }
      };
      window.addEventListener("keydown", keydown);
      return () => window.removeEventListener("keydown", keydown);
    }, [definition, selected2, selectedEdge]);
    const ranks = Object.fromEntries(definition.nodes.map((n) => [n.id, 0]));
    for (let pass = 0; pass < definition.nodes.length; pass++) for (const e of definition.edges) if (e.from in ranks && e.to in ranks) ranks[e.to] = Math.max(ranks[e.to], ranks[e.from] + 1);
    const lanes = {};
    const graphNodes = definition.nodes.map((n, i) => ({
      id: n.id,
      type: "workflowNode",
      position: { x: 80 + (lanes[ranks[n.id]] = (lanes[ranks[n.id]] ?? -1) + 1) * 340, y: 60 + ranks[n.id] * 240 },
      data: {
        order: i + 1,
        kind: n.kind,
        repeat: n.repeat,
        title: n.name,
        model: n.model?.mode === "explicit" ? n.model.id : "\u4F1A\u8BDD\u6A21\u578B",
        summary: n.prompt || (n.kind === "artifact" ? "\u5C55\u793A\u5E76\u4FDD\u5B58\u4E0A\u6E38\u6B65\u9AA4\u7684\u7ED3\u679C" : "\u914D\u7F6E\u6B64\u6B65\u9AA4\u7684\u6267\u884C\u884C\u4E3A"),
        mode: n.kind === "interact" ? n.interaction === "goal" ? "\u4EA4\u4E92\u76EE\u6807" : "\u4EA4\u4E92\u4E00\u6B21" : void 0,
        references: Object.values(n.input ?? {}).filter((r) => r.source === "node").map((r) => definition.nodes.find((x) => x.id === r.nodeId)).filter(Boolean)
      },
      className: `wf-node wf-node-${n.kind}`,
      selected: n.id === selected2
    }));
    const visibleEdges = definition.edges.filter((edge) => {
      if (edge.on && edge.on !== "success") return true;
      const seen = /* @__PURE__ */ new Set();
      const reaches = (id2) => {
        if (id2 === edge.to) return true;
        if (seen.has(id2)) return false;
        seen.add(id2);
        return definition.edges.filter((e) => e !== edge && e.from === id2 && (!e.on || e.on === "success")).some((e) => reaches(e.to));
      };
      return !reaches(edge.from);
    });
    const graphEdges = visibleEdges.map((e) => ({
      id: `${e.from}:${e.to}`,
      source: e.from,
      target: e.to,
      label: e.on === "true" ? "\u662F" : e.on === "false" ? "\u5426" : void 0,
      className: e.on === "false" ? "wf-edge-dashed" : void 0
    })).concat(definition.nodes.filter((n) => n.repeat?.target).map((n) => ({ id: `repeat:${n.id}`, source: n.id, target: n.repeat.target, sourceHandle: "retry-out", targetHandle: "retry-in", type: "smoothstep", label: `\u672A\u901A\u8FC7\uFF0C\u8FD4\u56DE\u4FEE\u6539 \xB7 \u6700\u591A ${n.repeat.maxRounds} \u8F6E`, className: "wf-edge-loop", deletable: false })));
    const latestRun = data.runs.find((item) => item.workflowId === record.id);
    (0, import_react11.useEffect)(() => {
      let live = true;
      if (!latestRun) {
        setRun(null);
        return () => {
          live = false;
        };
      }
      api({ action: "runRead", id: latestRun.id }).then((value) => {
        if (live) setRun(value);
      }).catch(() => {
      });
      return () => {
        live = false;
      };
    }, [latestRun?.id, latestRun?.status, panelTab]);
    const stepRun = run?.run?.nodes?.[selected2];
    const stepEvents = (run?.events ?? []).filter((e) => !e.nodeId || e.nodeId === selected2);
    const importDefinition = async (file) => {
      if (!file) return;
      try {
        const next = JSON.parse(await file.text());
        next.id = `workflow-${crypto.randomUUID()}`;
        const saved = await api({ action: "save", definition: next, expectedRevision: 0 });
        openEditor(saved.id);
      } catch (e) {
        setError(e.message);
      }
    };
    const saveDraft = async () => {
      try {
        await save(definition, record.revision);
        setError("");
      } catch (e) {
        setError(e.message);
      }
    };
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-editor", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-editor-viewbar", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-segmented", role: "tablist", "aria-label": "\u6B65\u9AA4\u5C55\u793A\u65B9\u5F0F", children: [["steps", "\u6B65\u9AA4\u5217\u8868"], ["graph", "\u6D41\u7A0B\u56FE"]].map(([id2, label]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { role: "tab", "aria-selected": editorView === id2, onClick: () => {
        setEditorView(id2);
        setRaw(false);
        localStorage.setItem("workflow-studio:editor-view", id2);
      }, children: label }, id2)) }) }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-editor-notice", role: "status", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: notice }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { disabled: !history.length, onClick: undo, children: "\u64A4\u9500" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon2, { label: "\u5173\u95ED\u63D0\u793A", icon: X, onClick: () => setNotice("") })
      ] }),
      skillEdit && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Modal, { title: `\u7F16\u8F91 skill \xB7 ${skillEdit.name}`, close: () => setSkillEdit(null), children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("textarea", { className: "wf-skill-content", "aria-label": "Skill \u5185\u5BB9", value: skillEdit.content, onChange: (e) => setSkillEdit({ ...skillEdit, content: e.target.value }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { className: "wf-primary", onClick: () => {
          update({ skillOverrides: { ...node.skillOverrides, [skillEdit.name]: skillEdit.content } });
          setSkillEdit(null);
        }, children: "\u5E94\u7528\u5230\u6B65\u9AA4" })
      ] }),
      assetsOpen && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Modal, { title: "\u6DFB\u52A0\u6B65\u9AA4", close: () => setAssetsOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-modal-body", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-step-picker", role: "menu", "aria-label": "\u66F4\u591A\u6B65\u9AA4\u9009\u9879", children: Object.entries(labels).filter(([kind]) => !["input", "interact", "agent", "artifact"].includes(kind)).map(([kind, label]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { role: "menuitem", onClick: () => {
        setAssetsOpen(false);
        add(kind);
      }, children: [
        glyphFor(kind, 20),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: label })
      ] }, kind)) }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-editor-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-stage", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-canvas", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-addbar", role: "toolbar", "aria-label": "\u6DFB\u52A0\u6B65\u9AA4", children: [
            Object.entries(labels).filter(([kind]) => ["input", "interact", "agent", "artifact"].includes(kind)).map(([kind, label]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
              "button",
              {
                draggable: true,
                onDragStart: (e) => e.dataTransfer.setData("application/workflow-node", kind),
                onClick: () => add(kind),
                children: [
                  glyphFor(kind, 14),
                  label
                ]
              },
              kind
            )),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-addbar-divider", "aria-hidden": "true" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { "aria-label": "\u66F4\u591A\u6B65\u9AA4", "aria-expanded": assetsOpen, onClick: () => setAssetsOpen(true), children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Plus, { size: 14 }),
              "\u66F4\u591A\u6B65\u9AA4"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              ref: importInput,
              type: "file",
              accept: "application/json,.json",
              hidden: true,
              "aria-label": "\u5BFC\u5165\u5DE5\u4F5C\u6D41\u6587\u4EF6",
              onChange: (e) => {
                void importDefinition(e.target.files?.[0]);
                e.target.value = "";
              }
            }
          ),
          raw ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-json", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            JsonField,
            {
              label: "\u5DE5\u4F5C\u6D41\u5B9A\u4E49",
              value: definition,
              change,
              rows: 30
            }
          ) }) : editorView === "steps" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(StepOutline, { definition, selected: selected2, onDelete: remove2, onSelect: (id2) => {
            setSelectedEdge(null);
            setSelected(id2);
            setPanelTab("step");
          } }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "div",
            {
              className: "wf-flow",
              ref: flowElement,
              onDragOver: (e) => e.preventDefault(),
              onDrop: (e) => {
                e.preventDefault();
                const kind = e.dataTransfer.getData("application/workflow-node");
                if (labels[kind]) add(kind, flow.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                index,
                {
                  onInit: (instance) => {
                    flow.current = instance;
                  },
                  nodeTypes,
                  nodes: graphNodes,
                  edges: graphEdges,
                  defaultEdgeOptions: {
                    type: "smoothstep",
                    markerEnd: { type: MarkerType.ArrowClosed }
                  },
                  nodesDraggable: false,
                  deleteKeyCode: null,
                  fitView: true,
                  fitViewOptions: { padding: 0.18 },
                  minZoom: 0.2,
                  maxZoom: 2,
                  onNodeClick: (_, n) => {
                    setSelectedEdge(null);
                    setSelected(n.id);
                    setPanelTab("step");
                  },
                  onEdgeClick: (_, e) => {
                    setSelected(null);
                    setSelectedEdge(e.id);
                  },
                  onNodesChange: (changes) => {
                    const nodes = applyNodeChanges(changes, graphNodes);
                    if (changes.some(
                      (c) => c.type === "position" || c.type === "remove"
                    ))
                      change({
                        ...definition,
                        nodes: definition.nodes.filter((n) => nodes.some((x) => x.id === n.id)).map((n) => ({
                          ...n,
                          position: nodes.find((x) => x.id === n.id).position
                        })),
                        edges: definition.edges.filter(
                          (e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to)
                        )
                      });
                  },
                  onEdgesChange: (changes) => {
                    if (changes.some((c) => c.type === "remove")) {
                      change(removeGraphItems(definition, [], changes.filter((c) => c.type === "remove" && !c.id.startsWith("repeat:")).map((c) => c.id)));
                    }
                  },
                  onConnect: (connection) => {
                    try {
                      change(connectReference(definition, connection.source, connection.target).definition);
                    } catch (e) {
                      setError(e.message);
                    }
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Controls, {})
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-canvas-tools", children: [
            editorView === "graph" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { onClick: () => flow.current?.fitView({ padding: 0.22, duration: 0 }), children: "\u67E5\u770B\u5168\u56FE" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: "\u590D\u5236\u8282\u70B9",
                icon: Copy,
                disabled: !node,
                onClick: () => node && setClipboard({ nodes: [structuredClone(node)], edges: definition.edges.filter((e) => e.from === node.id || e.to === node.id) })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: "\u7C98\u8D34\u8282\u70B9",
                icon: ClipboardPaste,
                disabled: !clipboard,
                onClick: () => {
                  if (!clipboard) return;
                  const next = pasteNodes(definition, clipboard);
                  const pasted = next.nodes.at(-1);
                  change(next);
                  setSelected(pasted.id);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: "\u64A4\u9500",
                icon: Undo2,
                disabled: !history.length,
                onClick: undo
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: raw ? "\u8FD4\u56DE\u753B\u5E03" : "\u7F16\u8F91 JSON",
                icon: FileText,
                "aria-pressed": raw,
                onClick: () => setRaw((v) => !v)
              }
            )
          ] })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("aside", { className: "wf-inspector", "aria-label": "\u6B65\u9AA4\u8BBE\u7F6E", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-panel-tabs", role: "tablist", "aria-label": "\u6B65\u9AA4\u9762\u677F", children: [["step", "\u6B65\u9AA4"], ["preview", "\u9884\u89C8"], ["console", "\u63A7\u5236\u53F0"], ["theme", "\u4E3B\u9898"]].map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "button",
            {
              role: "tab",
              "aria-selected": panelTab === key,
              onClick: () => setPanelTab(key),
              children: label
            },
            key
          )) }),
          panelTab !== "theme" && node && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: `wf-panel-head wf-step-${node.kind}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-step-glyph", children: glyphFor(node.kind, 14) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: node.name }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { children: labels[node.kind] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { className: "wf-delete-step", "aria-label": "\u5220\u9664\u8282\u70B9", title: "\u5220\u9664\u6B64\u6B65\u9AA4\uFF0C\u53EF\u64A4\u9500\u6062\u590D", onClick: () => remove2(), children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Trash2, { size: 15 }),
              "\u5220\u9664"
            ] })
          ] }),
          panelTab === "theme" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-panel-body", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u5DE5\u4F5C\u6D41\u56FE\u6807", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-icon-picker", children: ["workflow", "book", "search", "code", "file", "sparkles"].map((name2) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "button",
              {
                type: "button",
                "aria-label": `\u56FE\u6807 ${name2}`,
                "aria-pressed": (definition.icon ?? "workflow") === name2,
                onClick: () => change({ ...definition, icon: name2 }),
                children: glyphFor(name2, 16)
              },
              name2
            )) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u6B65\u9AA4\u914D\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-swatches", children: Object.entries(labels).map(([kind, label]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `wf-swatch wf-step-${kind}`, children: label }, kind)) }) })
          ] }) : panelTab === "preview" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-panel-body", children: !run ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-panel-empty", children: "\u8FD8\u6CA1\u6709\u8FD0\u884C\u8BB0\u5F55" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("p", { className: "wf-panel-note", children: [
              "\u6700\u8FD1\u4E00\u6B21\u8FD0\u884C \xB7 ",
              statuses[run.run.status] ?? run.run.status,
              " \xB7 ",
              timestamp(run.run.createdAt)
            ] }),
            stepRun ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-panel-note", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `wf-status ${stepRun.status}`, children: statuses[stepRun.status] ?? stepRun.status }) }),
              stepRun.error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-error", children: stepRun.error }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("pre", { className: "wf-output", children: typeof stepRun.output === "string" ? stepRun.output : pretty2(stepRun.output ?? null) })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-panel-empty", children: "\u8BE5\u6B65\u9AA4\u8FD8\u6CA1\u6709\u8F93\u51FA" })
          ] }) }) : panelTab === "console" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-panel-body", children: [
            stepEvents.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-panel-empty", children: "\u6682\u65E0\u8BE5\u6B65\u9AA4\u7684\u4E8B\u4EF6" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ul", { className: "wf-console", children: stepEvents.map((event, index2) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("li", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("time", { children: timestamp(event.at ?? event.createdAt) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
                event.type ?? event.kind ?? "event",
                event.error ? ` \xB7 ${event.error}` : ""
              ] })
            ] }, `${event.type ?? "event"}-${index2}`)) }),
            run?.run?.nodes && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "wf-advanced", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { children: "\u8FD0\u884C\u8BE6\u60C5" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("pre", { className: "wf-output", children: pretty2(run.run.nodes) })
            ] })
          ] }) : node ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-panel-body", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-prompt-label", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Sparkles, { size: 12 }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: node.kind === "interact" ? node.interaction === "goal" ? "\u4EA4\u4E92\u76EE\u6807" : "\u63D0\u95EE\u5185\u5BB9" : "\u6B65\u9AA4\u8BF4\u660E" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                Icon2,
                {
                  label: "\u7F16\u8F91\u6B65\u9AA4\u8BF4\u660E",
                  icon: Pencil,
                  size: 12,
                  onClick: () => document.querySelector(".wf-panel-body .wf-step-prompt")?.focus()
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              StepPrompt,
              {
                node,
                definition,
                onChange: (prompt) => update({ prompt }),
                onReference: (source) => {
                  try {
                    change(connectReference(definition, source, node.id).definition);
                  } catch (e) {
                    setError(e.message);
                  }
                }
              },
              node.id
            ),
            (node.kind === "agent" || node.kind === "interact" && node.interaction === "goal") && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "wf-routing-settings", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("summary", { children: [
                "\u6A21\u578B\u4E0E\u6267\u884C\u8BBE\u7F6E \xB7 ",
                node.model?.mode === "explicit" ? node.model.id : "\u7EE7\u627F\u4F1A\u8BDD"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Routing, { node, update, caps })
            ] }),
            node.kind === "agent" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "wf-settings-group", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("summary", { children: [
                "\u6280\u80FD\u4E0E\u5DE5\u5177 ",
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("small", { children: [
                  (node.skills?.length ?? 0) + (node.tools?.length ?? 0),
                  " \u9879"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Field, { label: "\u6280\u80FD", children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                  "input",
                  {
                    list: "wf-skills",
                    value: (node.skills ?? []).join(", "),
                    onChange: (e) => update({
                      skills: e.target.value.split(",").map((v) => v.trim()).filter(Boolean)
                    })
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("datalist", { id: "wf-skills", children: (caps?.skills ?? []).map((s) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: s.name }, s.name)) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-skill-edit-links", children: (node.skills ?? []).map((name2) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { onClick: async () => {
                try {
                  const result = await api({ action: "skillRead", name: name2 });
                  setSkillEdit({ name: name2, content: node.skillOverrides?.[name2] ?? result.content });
                } catch (e) {
                  setError(e.message);
                }
              }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Pencil, { size: 14 }),
                "\u7F16\u8F91 ",
                name2
              ] }, name2)) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u5DE5\u5177", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "input",
                {
                  list: "wf-tools",
                  value: (node.tools ?? []).join(", "),
                  onChange: (e) => update({
                    tools: e.target.value.split(",").map((v) => v.trim()).filter(Boolean)
                  })
                }
              ) })
            ] }),
            node.kind === "tool" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "Tool", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "input",
              {
                list: "wf-tools",
                value: node.tool ?? "",
                onChange: (e) => update({ tool: e.target.value })
              }
            ) }),
            node.kind === "interact" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u4EA4\u4E92\u65B9\u5F0F", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "select",
                {
                  value: node.interaction ?? "once",
                  onChange: (e) => update({
                    interaction: e.target.value,
                    ...e.target.value === "once" ? { maxTurns: void 0 } : {}
                  }),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "once", children: "\u4EA4\u4E92\u4E00\u6B21\uFF1A\u7528\u6237\u56DE\u7B54\u4E00\u6B21\u540E\u7EE7\u7EED" }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "goal", children: "\u4EA4\u4E92\u76EE\u6807\uFF1A\u53CD\u590D\u6F84\u6E05\u76F4\u5230\u786E\u8BA4\u7406\u89E3" })
                  ]
                }
              ) }),
              node.interaction === "goal" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u6700\u591A\u56DE\u7B54\u8F6E\u6B21", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "input",
                {
                  type: "number",
                  min: "1",
                  max: "20",
                  value: node.maxTurns ?? 8,
                  onChange: (e) => update({ maxTurns: Number(e.target.value) })
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u5DF2\u6709\u6750\u6599\u65F6\u8DF3\u8FC7\u63D0\u95EE", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                "select",
                {
                  value: node.provided ? ["/text", "/attachments"].includes(node.provided.path) ? node.provided.path : "custom" : "",
                  onChange: (e) => update({
                    provided: e.target.value ? e.target.value === "custom" ? node.provided : { source: "workflow", path: e.target.value } : void 0
                  }),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "", children: "\u6BCF\u6B21\u63D0\u95EE" }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "/attachments", children: "\u6D88\u606F\u5DF2\u5E26\u9644\u4EF6\u65F6\u76F4\u63A5\u91C7\u7528" }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "/text", children: "\u6D88\u606F\u6587\u672C\u5C31\u662F\u6750\u6599\u65F6\u76F4\u63A5\u91C7\u7528" }),
                    node.provided && !["/text", "/attachments"].includes(node.provided.path) && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "custom", children: "\u81EA\u5B9A\u4E49\u5F15\u7528" })
                  ]
                }
              ) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("datalist", { id: "wf-tools", children: (caps?.tools ?? []).map((t) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: t }, t)) }),
            node.kind === "agent" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "wf-review-settings", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("summary", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "\u8BC4\u5BA1\u4E0E\u5FAA\u73AF" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-setting-value", children: node.repeat ? "\u5DF2\u5F00\u542F" : "\u672A\u5F00\u542F" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { type: "checkbox", checked: Boolean(node.repeat), onChange: (e) => {
                  if (e.target.checked) update({ repeat: { target: definition.nodes.find((n) => n.id !== node.id && n.kind === "agent")?.id ?? "", until: { ">=": [{ var: "score" }, 85] }, maxRounds: 3, sessionMode: "new" } });
                  else {
                    const next = { ...node };
                    delete next.repeat;
                    change({ ...definition, nodes: definition.nodes.map((n) => n.id === node.id ? next : n) });
                  }
                } }),
                "\u6839\u636E\u7ED3\u679C\u8FD4\u56DE\u4FEE\u8BA2"
              ] }),
              node.repeat && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u8FD4\u56DE\u6B65\u9AA4", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("select", { value: node.repeat.target, onChange: (e) => update({ repeat: { ...node.repeat, target: e.target.value } }), children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "", children: "\u9009\u62E9\u4E0A\u6E38\u6B65\u9AA4" }),
                  definition.nodes.filter((n) => n.id !== node.id && n.kind === "agent").map((n) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: n.id, children: n.name }, n.id))
                ] }) }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u6BCF\u8F6E\u4F1A\u8BDD", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("select", { value: node.repeat.sessionMode, onChange: (e) => update({ repeat: { ...node.repeat, sessionMode: e.target.value } }), children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "new", children: "\u65B0\u5EFA\u4F1A\u8BDD\uFF0C\u4F20\u5165\u6750\u6599\u4E0E\u53CD\u9988" }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "continue", children: "\u63A5\u7740\u4E0A\u6B21\u4F1A\u8BDD\u7EE7\u7EED" })
                ] }) }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u6700\u591A\u8BC4\u5BA1\u8F6E\u6570", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { type: "number", min: "1", max: "20", value: node.repeat.maxRounds, onChange: (e) => update({ repeat: { ...node.repeat, maxRounds: Number(e.target.value) } }) }) }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(JsonField, { label: "\u901A\u8FC7\u6761\u4EF6", value: node.repeat.until, change: (until) => update({ repeat: { ...node.repeat, until } }) })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "wf-advanced", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { children: "\u9AD8\u7EA7\u8BBE\u7F6E" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u6B65\u9AA4\u6807\u8BC6", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { value: node.id, readOnly: true }) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                JsonField,
                {
                  label: "\u8F93\u5165\u6620\u5C04",
                  value: node.input,
                  change: (input) => update({ input })
                }
              ),
              node.kind === "condition" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                JsonField,
                {
                  label: "\u6761\u4EF6",
                  value: node.condition,
                  change: (condition) => update({ condition })
                }
              ),
              !(node.kind === "interact" && node.interaction !== "goal") && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                JsonField,
                {
                  label: "\u8F93\u51FA\u6570\u636E\u7ED3\u6784",
                  value: node.outputSchema ?? { type: "object" },
                  change: (outputSchema) => update({ outputSchema })
                }
              ),
              ["loop", "subworkflow"].includes(node.kind) && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                JsonField,
                {
                  label: "\u5B50\u5DE5\u4F5C\u6D41\u7248\u672C",
                  value: node.workflow ?? { id: "", revision: 1 },
                  change: (workflow) => update({ workflow })
                }
              ),
              node.kind !== "interact" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u8D85\u65F6\uFF08\u79D2\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "input",
                {
                  type: "number",
                  min: "1",
                  max: "3600",
                  value: node.timeoutSeconds ?? 600,
                  onChange: (e) => update({ timeoutSeconds: Number(e.target.value) })
                }
              ) }),
              node.kind === "loop" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u6700\u5927\u6761\u76EE\u6570", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "input",
                {
                  type: "number",
                  min: "1",
                  max: "100",
                  value: node.maxItems ?? 10,
                  onChange: (e) => update({ maxItems: Number(e.target.value) })
                }
              ) }),
              definition.edges.filter((e) => e.from === node.id).map((e) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                Field,
                {
                  label: `\u8FDE\u63A5\u81F3 ${definition.nodes.find((n) => n.id === e.to)?.name}`,
                  children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
                    "select",
                    {
                      value: e.on ?? "success",
                      onChange: (event) => change({
                        ...definition,
                        edges: definition.edges.map(
                          (x) => x === e ? { ...e, on: event.target.value } : x
                        )
                      }),
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "success", children: "\u6210\u529F" }),
                        node.kind === "condition" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "true", children: "\u662F" }),
                          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "false", children: "\u5426" })
                        ] })
                      ]
                    }
                  )
                },
                e.to
              ))
            ] })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-panel-empty", children: "\u672A\u9009\u62E9\u6B65\u9AA4" }),
          error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-error", role: "alert", children: error })
        ] })
      ] })
    ] });
  }
  function Runs({ id: id2 }) {
    const data = useData();
    const [detail, setDetail] = (0, import_react11.useState)(null);
    const [error, setError] = (0, import_react11.useState)("");
    const action = async (args) => {
      try {
        await api(args);
        await refresh();
        if (detail)
          setDetail(await api({ action: "runRead", id: detail.run.id }));
      } catch (e) {
        setError(e.message);
      }
    };
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-scroll", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("table", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u8FD0\u884C" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u7248\u672C" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u72B6\u6001" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u65F6\u95F4" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u64CD\u4F5C" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("tbody", { children: data.runs.filter((r) => r.workflowId === id2).map((r) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "button",
            {
              onClick: async () => setDetail(await api({ action: "runRead", id: r.id })),
              children: r.id.slice(0, 18)
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
            "v",
            r.revision
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `wf-status ${r.status}`, children: statuses[r.status] ?? r.status }) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: timestamp(r.createdAt) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: "\u6253\u5F00\u8FD0\u884C\u4F1A\u8BDD",
                icon: MessageSquare,
                onClick: async () => {
                  await ctx.sessions.refresh();
                  openSession(r.sessionId);
                }
              }
            ),
            r.status === "running" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                Icon2,
                {
                  label: "\u6682\u505C\u8FD0\u884C",
                  icon: Pause,
                  onClick: () => action({ action: "pause", id: r.id })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                Icon2,
                {
                  label: "\u53D6\u6D88\u8FD0\u884C",
                  icon: Square,
                  onClick: () => action({ action: "cancel", id: r.id })
                }
              )
            ] }) : [
              "paused",
              "failed",
              "needs_attention",
              "waiting_approval",
              "cancelled"
            ].includes(r.status) && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: "\u6062\u590D\u8FD0\u884C",
                icon: Play,
                onClick: () => setDetail({ run: r, events: [], artifacts: [] })
              }
            )
          ] })
        ] }, r.id)) })
      ] }),
      !data.runs.some((r) => r.workflowId === id2) && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-muted", children: "\u6682\u65E0\u8FD0\u884C\u8BB0\u5F55" }),
      error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { role: "alert", className: "wf-error", children: error }),
      detail && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Modal, { title: "\u8FD0\u884C\u8BE6\u60C5", close: () => setDetail(null), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("p", { children: [
          statuses[detail.run.status],
          " \xB7 v",
          detail.run.revision
        ] }),
        detail.run.error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-error", children: detail.run.error }),
        (() => {
          const entry = Object.entries(detail.run.nodes ?? {}).find(
            ([, n]) => n.status === "waiting_input"
          );
          if (detail.run.status !== "waiting_input" || !entry) return null;
          const [nodeId, state] = entry;
          const info = state.interaction ?? {};
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-interaction", "data-wf-interaction": nodeId, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: info.phase === "confirm" ? "\u7B49\u5F85\u4F60\u786E\u8BA4\u7406\u89E3" : "\u7B49\u5F85\u4F60\u7684\u56DE\u7B54" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: info.question }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("small", { children: [
              "\u7B2C ",
              info.turns ?? 0,
              " / ",
              info.maxTurns ?? 1,
              " \u8F6E \xB7 \u5728\u8FD0\u884C\u4F1A\u8BDD\u91CC\u56DE\u7B54\uFF0C\u6216\u5728\u8FD9\u91CC\u8DF3\u8FC7\u53BB\u56DE\u590D"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
              "button",
              {
                className: "wf-primary",
                onClick: async () => {
                  await ctx.sessions.refresh();
                  openSession(detail.run.sessionId);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MessageSquare, { size: 16 }),
                  "\u53BB\u5BF9\u8BDD\u56DE\u7B54"
                ]
              }
            )
          ] });
        })(),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RunTimeline, { ctx, api, runId: detail.run.id, openSession, onChange: refresh }),
        detail.artifacts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            onClick: async () => {
              const artifact = await api({
                action: "artifact",
                id: a.id
              });
              download(
                artifact.name,
                artifact.content,
                artifact.mediaType
              );
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Download, { size: 16 }),
              a.name
            ]
          },
          a.id
        )),
        [
          "paused",
          "failed",
          "needs_attention",
          "waiting_approval",
          "cancelled"
        ].includes(detail.run.status) && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: "\u6062\u590D\u4F1A\u91CD\u65B0\u6267\u884C\u672A\u5B8C\u6210\u8282\u70B9\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "button",
            {
              className: "wf-primary",
              onClick: () => action({
                action: "resume",
                runId: detail.run.id,
                sessionId: detail.run.sessionId,
                response: true,
                background: true
              }),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Play, { size: 16 }),
                "\u786E\u8BA4\u5E76\u6062\u590D"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { children: "\u4E8B\u4EF6\u8BB0\u5F55" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("pre", { children: pretty2(detail.events) })
        ] })
      ] }) })
    ] });
  }
  function Schedules({ record, caps }) {
    const data = useData();
    const [plan, setPlan] = (0, import_react11.useState)(null);
    const [preview, setPreview] = (0, import_react11.useState)([]);
    const [error, setError] = (0, import_react11.useState)("");
    const perform = async (fn, label = "") => {
      if (busy) return;
      if (label) setBusy(label);
      try {
        await fn();
        setError("");
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy("");
      }
    };
    const update = (patch) => setPlan((p) => ({ ...p, ...patch }));
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-scroll", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { children: "\u5B9A\u65F6\u4EFB\u52A1" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            onClick: () => setPlan({
              workflowId: record.id,
              workflowRevision: record.published ?? record.revision,
              kind: "cron",
              cron: "0 9 * * *",
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              cwd: ctx.sessions.list.getSnapshot().byId[current()]?.cwd ?? "",
              input: { text: "" },
              rootRoute: { provider: "", model: "" },
              enabled: true,
              missed: "skip",
              overlap: "skip",
              tools: []
            }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Plus, { size: 16 }),
              "\u6DFB\u52A0\u5B9A\u65F6\u4EFB\u52A1"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("table", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u65F6\u95F4" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u4E0B\u6B21\u6267\u884C" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u7248\u672C" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u72B6\u6001" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u64CD\u4F5C" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("tbody", { children: data.schedules.filter((p) => p.workflowId === record.id).map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
            p.cron ?? p.at ?? `${p.seconds}s`,
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("small", { children: p.timezone })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: timestamp(p.nextAt) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
            "v",
            p.workflowRevision
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: p.enabled ? "\u542F\u7528" : "\u505C\u7528" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: "\u7F16\u8F91\u5B9A\u65F6\u4EFB\u52A1",
                icon: Settings2,
                onClick: () => setPlan(p)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              Icon2,
              {
                label: "\u5220\u9664\u5B9A\u65F6\u4EFB\u52A1",
                icon: Trash2,
                onClick: () => perform(
                  () => api({ action: "scheduleDelete", id: p.id })
                )
              }
            )
          ] })
        ] }, p.id)) })
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { role: "alert", className: "wf-error", children: error }),
      plan && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Modal, { title: "\u5B9A\u65F6\u4EFB\u52A1", close: () => setPlan(null), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u7C7B\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "select",
          {
            value: plan.kind,
            onChange: (e) => update({ kind: e.target.value }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "cron", children: "\u56FA\u5B9A\u65E5\u7A0B" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "once", children: "\u5355\u6B21" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "interval", children: "\u56FA\u5B9A\u95F4\u9694" })
            ]
          }
        ) }),
        plan.kind === "cron" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "Cron", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              value: plan.cron ?? "",
              onChange: (e) => update({ cron: e.target.value })
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u65F6\u533A", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              value: plan.timezone ?? "",
              onChange: (e) => update({ timezone: e.target.value })
            }
          ) })
        ] }) : plan.kind === "once" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u6267\u884C\u65F6\u95F4\uFF08\u542B\u65F6\u533A\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            value: plan.at ?? "",
            placeholder: "2026-09-14T09:00:00+08:00",
            onChange: (e) => update({ at: e.target.value })
          }
        ) }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u95F4\u9694\uFF08\u79D2\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            type: "number",
            min: "60",
            value: plan.seconds ?? 3600,
            onChange: (e) => update({ seconds: Number(e.target.value) })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u5DE5\u4F5C\u76EE\u5F55", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            value: plan.cwd,
            onChange: (e) => update({ cwd: e.target.value })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u56FA\u5B9A\u7248\u672C", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            type: "number",
            min: "1",
            max: record.revision,
            value: plan.workflowRevision,
            onChange: (e) => update({ workflowRevision: Number(e.target.value) })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "Provider", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "select",
          {
            value: plan.rootRoute.provider,
            onChange: (e) => update({
              rootRoute: { provider: e.target.value, model: "" }
            }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "", children: "\u9009\u62E9 Provider" }),
              caps?.providers?.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: p.id, children: p.name }, p.id))
            ]
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "Model", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            value: plan.rootRoute.model,
            onChange: (e) => update({
              rootRoute: { ...plan.rootRoute, model: e.target.value }
            })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u63A8\u7406\u5F3A\u5EA6", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            value: plan.rootRoute.reasoningEffort ?? "",
            onChange: (e) => update({
              rootRoute: {
                ...plan.rootRoute,
                reasoningEffort: e.target.value || void 0
              }
            })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          JsonField,
          {
            label: "\u8F93\u5165",
            value: plan.input,
            change: (input) => update({ input })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u9519\u8FC7\u6267\u884C", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "select",
          {
            value: plan.missed,
            onChange: (e) => update({ missed: e.target.value }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "skip", children: "\u8DF3\u8FC7" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "latest", children: "\u8865\u6267\u884C\u6700\u8FD1\u4E00\u6B21" })
            ]
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u8FD0\u884C\u91CD\u53E0", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "select",
          {
            value: plan.overlap,
            onChange: (e) => update({ overlap: e.target.value }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "skip", children: "\u8DF3\u8FC7" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "latest", children: "\u6392\u961F\u6700\u8FD1\u4E00\u6B21" })
            ]
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u5141\u8BB8\u7684\u5DE5\u5177", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            value: (plan.tools ?? []).join(", "),
            onChange: (e) => update({
              tools: e.target.value.split(",").map((v) => v.trim()).filter(Boolean)
            })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              type: "checkbox",
              checked: plan.enabled,
              onChange: (e) => update({ enabled: e.target.checked })
            }
          ),
          "\u542F\u7528"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("p", { className: "wf-muted", children: [
          "Host \u5728\u7EBF\u65F6\u6267\u884C \xB7 ",
          plan.timezone
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            onClick: () => perform(
              async () => setPreview(await api({ action: "schedulePreview", plan }))
            ),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Clock, { size: 16 }),
              "\u9884\u89C8\u6267\u884C\u65F6\u95F4"
            ]
          }
        ),
        preview.map((at) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: timestamp(at) }, at)),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            className: "wf-primary",
            onClick: () => perform(async () => {
              await api({
                action: "scheduleSave",
                plan,
                expectedRevision: plan.revision ?? 0
              });
              setPlan(null);
            }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Save, { size: 16 }),
              "\u4FDD\u5B58\u5B9A\u65F6\u4EFB\u52A1"
            ]
          }
        ),
        error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { role: "alert", className: "wf-error", children: error })
      ] }) })
    ] });
  }
  function Panel2() {
    const selected2 = usePanel();
    const data = useData();
    const header = useHeaderDraft();
    const [record, setRecord] = (0, import_react11.useState)(null);
    const [caps, setCaps] = (0, import_react11.useState)(null);
    const [error, setError] = (0, import_react11.useState)("");
    const [trial, setTrial] = (0, import_react11.useState)(false);
    const [input, setInput] = (0, import_react11.useState)({ text: "" });
    const [versions, setVersions] = (0, import_react11.useState)([]);
    const [archived, setArchived] = (0, import_react11.useState)(false);
    const [moreOpen, setMoreOpen] = (0, import_react11.useState)(false);
    const [busy2, setBusy2] = (0, import_react11.useState)("");
    const load = async () => {
      if (selected2.id)
        setRecord(await api({ action: "read", id: selected2.id }));
    };
    const revision = data.workflows.find((w) => w.id === selected2.id)?.revision;
    (0, import_react11.useEffect)(() => {
      setRecord(null);
      setError("");
      load().catch((e) => setError(e.message));
      api({ action: "capabilities", sessionId: current() }).then(setCaps).catch((e) => setError(e.message));
    }, [selected2.id]);
    (0, import_react11.useEffect)(() => {
      if (selected2.id) load().catch((e) => setError(e.message));
    }, [revision]);
    (0, import_react11.useEffect)(() => {
      if (selected2.tab === "versions" && selected2.id)
        api({ action: "versions", id: selected2.id }).then(setVersions).catch((e) => setError(e.message));
    }, [selected2]);
    const perform = async (fn) => {
      try {
        await fn();
        setError("");
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    };
    const section = selected2.tab === "graph" ? "editor" : "app";
    const draft = header.key === `${record?.id}:${record?.revision}` ? header : null;
    const saveFromBar = () => perform(async () => {
      if (draft?.save) await draft.save();
      else
        await api({
          action: "save",
          definition: record.snapshot.definition,
          expectedRevision: record.revision
        });
      await load();
    });
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("main", { className: "wf wf-main", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("header", { className: "wf-appbar", children: record ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          Icon2,
          {
            label: "\u8FD4\u56DE\u5DE5\u4F5C\u6D41\u5217\u8868",
            icon: ArrowLeft,
            onClick: () => openEditor(null)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "span",
          {
            className: `wf-workflow-icon wf-icon-${record.icon ?? "workflow"}`,
            "aria-hidden": "true",
            children: glyphFor(record.icon, 15)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "input",
          {
            className: "wf-appbar-name",
            "aria-label": "\u5DE5\u4F5C\u6D41\u540D\u79F0",
            disabled: !draft?.rename,
            value: draft?.definition?.name ?? record.name,
            onChange: (e) => draft?.rename?.(e.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "span",
          {
            className: `wf-chip ${record.published === record.revision ? "is-published" : ""}`,
            children: record.published === record.revision ? `\u5DF2\u53D1\u5E03 v${record.revision}` : `\u8349\u7A3F v${record.revision}`
          }
        ),
        section === "editor" && draft && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `wf-chip ${draft.dirty ? "is-dirty" : ""}`, children: draft.dirty ? "\u672A\u4FDD\u5B58" : "\u5DF2\u4FDD\u5B58" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-segmented", role: "tablist", "aria-label": "\u5DE5\u4F5C\u6D41\u89C6\u56FE", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "button",
            {
              role: "tab",
              "aria-selected": section === "editor",
              onClick: () => openEditor(record.id, "graph"),
              children: "\u7F16\u8F91\u5668"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "button",
            {
              role: "tab",
              "aria-selected": section === "app",
              onClick: () => openEditor(record.id, "runs"),
              children: "\u8FD0\u884C\u8BB0\u5F55"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { onClick: () => perform(() => bind(record, void 0, "author")), children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MessageSquare, { size: 16 }),
          "\u5BF9\u8BDD\u4FEE\u6539"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "wf-editor-debug", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { type: "checkbox", "aria-label": "\u9010\u6B65\u8C03\u8BD5", checked: Boolean(data.workflows.find((w) => w.id === record.id)?.debug), onChange: (e) => perform(() => api({ action: "setWorkflowDebug", id: record.id, debug: e.target.checked })) }),
          "\u9010\u6B65\u8C03\u8BD5"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { className: "wf-primary", onClick: () => setTrial(true), children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Play, { size: 16 }),
          "\u8BD5\u8FD0\u884C"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon2, { label: "\u4FDD\u5B58\u7248\u672C", icon: Save, onClick: () => void saveFromBar() }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            disabled: record.published === record.revision || Boolean(draft?.dirty),
            title: draft?.dirty ? "\u5148\u4FDD\u5B58\u4FEE\u6539\uFF0C\u518D\u53D1\u5E03\u7248\u672C" : "\u5C06\u4FDD\u5B58\u7684\u7248\u672C\u7528\u4E8E\u540E\u7EED\u4EFB\u52A1",
            onClick: () => perform(async () => {
              await api({
                action: "publish",
                id: record.id,
                revision: record.revision
              });
              await load();
            }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Check, { size: 16 }),
              record.published === record.revision ? "\u5DF2\u53D1\u5E03" : "\u53D1\u5E03\u7248\u672C"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          import_dsh_client_ui_primitives3.Menu,
          {
            open: moreOpen,
            onClose: () => setMoreOpen(false),
            items: [
              { id: "export", label: "\u5BFC\u51FA\u5B9A\u4E49", icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Download, { size: 16 }) },
              { id: "copy", label: "\u62F7\u8D1D\u5DE5\u4F5C\u6D41", icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Copy, { size: 16 }) },
              { id: "archive", label: record.archived ? "\u6062\u590D\u5DE5\u4F5C\u6D41" : "\u5F52\u6863\u5DE5\u4F5C\u6D41", icon: record.archived ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Undo2, { size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Archive, { size: 16 }) },
              { id: "manage", label: "\u7BA1\u7406\u5DE5\u4F5C\u6D41", icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Settings2, { size: 16 }) }
            ],
            onSelect: (action) => {
              setMoreOpen(false);
              if (action === "export")
                download(`${record.id}.json`, pretty2(record.snapshot.definition));
              if (action === "copy")
                void perform(async () => {
                  const created = await api({ action: "copy", id: record.id });
                  await refresh();
                  openEditor(created.id);
                }, "copy");
              if (action === "archive")
                void perform(
                  () => api({ action: "archive", id: record.id, archived: !record.archived }),
                  "archive"
                );
              if (action === "manage") openEditor(null);
            },
            anchor: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "button",
              {
                type: "button",
                "aria-label": "\u66F4\u591A\u5DE5\u4F5C\u6D41\u64CD\u4F5C",
                "aria-expanded": moreOpen,
                onClick: () => setMoreOpen((v) => !v),
                children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Ellipsis, { size: 16 })
              }
            )
          }
        )
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-workflow-icon", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GitBranch, { size: 15 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h1", { children: "\u5DE5\u4F5C\u6D41" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "wf-spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "wf-import", title: "\u5BFC\u5165\u5DE5\u4F5C\u6D41", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Upload, { size: 16 }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              "aria-label": "\u5BFC\u5165\u5DE5\u4F5C\u6D41",
              type: "file",
              accept: "application/json,.json",
              onChange: (e) => perform(async () => {
                const definition = JSON.parse(
                  await e.target.files[0].text()
                );
                definition.id = `workflow-${crypto.randomUUID()}`;
                const w = await api({
                  action: "save",
                  definition,
                  expectedRevision: 0
                });
                openEditor(w.id);
              })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            className: "wf-primary",
            disabled: busy2 === "create",
            "aria-busy": busy2 === "create",
            onClick: () => perform(() => beginAuthorSession(), "create"),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Plus, { size: 16 }),
              busy2 === "create" ? "\u6B63\u5728\u521B\u5EFA\u2026" : "\u521B\u5EFA\u5DE5\u4F5C\u6D41"
            ]
          }
        )
      ] }) }),
      (error || data.error) && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-error-bar", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TriangleAlert, { size: 15, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "wf-error", children: error || data.error }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            type: "button",
            onClick: () => {
              setError("");
              void load().catch((e) => setError(e.message));
              void refresh();
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RefreshCw, { size: 14, "aria-hidden": "true" }),
              "\u91CD\u8BD5"
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon2, { label: "\u5173\u95ED\u63D0\u793A", icon: X, onClick: () => setError("") })
      ] }),
      record ? section === "editor" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Editor,
        {
          record,
          caps,
          save: async (definition, expectedRevision) => {
            await api({ action: "save", definition, expectedRevision });
            await load();
            await refresh();
          }
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("nav", { className: "wf-tabs", "aria-label": "\u5DE5\u4F5C\u6D41\u89C6\u56FE", children: [
          ["runs", "\u8FD0\u884C\u8BB0\u5F55"],
          ["schedules", "\u5B9A\u65F6\u4EFB\u52A1"],
          ["versions", "\u7248\u672C\u5386\u53F2"]
        ].map(([tab, label]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            "aria-current": selected2.tab === tab ? "page" : void 0,
            onClick: () => openEditor(record.id, tab),
            children: label
          },
          tab
        )) }),
        selected2.tab === "runs" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Runs, { id: record.id }),
        " ",
        selected2.tab === "schedules" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Schedules, { record, caps }),
        " ",
        selected2.tab === "versions" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "wf-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("table", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u7248\u672C" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u540D\u79F0" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u65F6\u95F4" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: "\u64CD\u4F5C" })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("tbody", { children: versions.map((v) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
              "v",
              v.revision
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: v.definition.name }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: timestamp(v.createdAt) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                Icon2,
                {
                  label: `\u5BFC\u51FA v${v.revision}`,
                  icon: Download,
                  onClick: () => download(
                    `${record.id}-v${v.revision}.json`,
                    pretty2(v.definition)
                  )
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                "button",
                {
                  onClick: () => perform(async () => {
                    await api({
                      action: "save",
                      definition: v.definition,
                      expectedRevision: record.revision
                    });
                    await load();
                    openEditor(record.id);
                  }),
                  children: "\u6062\u590D\u4E3A\u65B0\u7248\u672C"
                }
              )
            ] })
          ] }, v.revision)) })
        ] }) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Gallery, { data, onError: setError }),
      trial && record && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Modal, { title: "\u8BD5\u8FD0\u884C", close: () => setTrial(false), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "wf-modal-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          JsonField,
          {
            label: "\u8F93\u5165\u6750\u6599",
            value: input,
            change: setInput,
            rows: 12
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "button",
          {
            className: "wf-primary",
            onClick: () => perform(async () => {
              const sessionId = current() ?? await newSession();
              await api({
                action: "bind",
                id: record.id,
                revision: record.revision,
                sessionId,
                mode: "author"
              });
              await api({
                action: "run",
                id: record.id,
                revision: record.revision,
                input,
                sessionId,
                background: true
              });
              setTrial(false);
              openEditor(record.id, "runs");
            }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Play, { size: 16 }),
              "\u6267\u884C v",
              record.revision
            ]
          }
        )
      ] }) })
    ] });
  }
  function BindingTag({ sessionId }) {
    const data = useData();
    const binding = data.bindings.find((item) => item.sessionId === sessionId);
    const creating = (data.authoring ?? []).some((item) => item.sessionId === sessionId);
    const step = data.stepSessions?.find((item) => item.sessionId === sessionId);
    if (step) return null;
    if (!binding && !creating) return null;
    const workflow = binding ? data.workflows.find((w) => w.id === binding.workflowId) : void 0;
    const authoring = creating || binding?.mode === "author";
    const active = data.runs.find(
      (item) => item.sessionId === sessionId && ["running", "waiting_approval", "waiting_input", "paused"].includes(
        item.status
      )
    );
    const latest = data.runs.find((r) => r.sessionId === sessionId);
    const recipients = (data.stepSessions ?? []).filter((s) => s.runId === latest?.id);
    if (!authoring) return null;
    const name2 = workflow?.name ?? "\u65B0\u5DE5\u4F5C\u6D41";
    const label = authoring ? creating ? "\u6B63\u5728\u521B\u5EFA\u5DE5\u4F5C\u6D41" : "\u6B63\u5728\u4FEE\u6539\u5DE5\u4F5C\u6D41" : "\u5DE5\u4F5C\u6D41\u8FD0\u884C\u4F1A\u8BDD";
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
      "span",
      {
        className: "wf-composer-tag",
        "data-mode": authoring ? "author" : "run",
        "data-workflow-tag": binding?.workflowId ?? "new",
        title: `${label} \xB7 ${name2}`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
            "button",
            {
              type: "button",
              className: "wf-composer-tag-open",
              "aria-label": `${label}\uFF1A${name2}`,
              onClick: () => openEditor(binding?.workflowId ?? null),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Workflow, { size: 13, "aria-hidden": "true" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: name2 }),
                binding && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("small", { children: [
                  "v",
                  binding.revision
                ] })
              ]
            }
          ),
          active && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `wf-status ${active.status}`, children: statuses[active.status] ?? active.status }),
          binding && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "button",
            {
              type: "button",
              className: "wf-composer-tag-clear",
              "aria-label": "\u7ED3\u675F\u7ED1\u5B9A",
              title: "\u7ED3\u675F\u7ED1\u5B9A",
              onClick: () => void unbind(sessionId),
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(X, { size: 12, "aria-hidden": "true" })
            }
          )
        ]
      }
    );
  }
  ctx.effect(() => {
    const style2 = document.createElement("style");
    style2.dataset.plugin = name;
    style2.textContent = style_default3 + "\n" + style_default4;
    document.head.appendChild(style2);
    return () => style2.remove();
  });
  ctx.slots.inject(
    "main",
    () => ctx.slots.register({ name: "main", key: "workflow-studio" }, Panel2)
  );
  ctx.slots.inject("conversation.session", () => {
    const native = ctx.slots.entriesOfSlot("conversation.session")[0];
    if (!native?.component) return;
    const Native = native.component;
    const Wrapped = (props) => {
      const data = useData();
      const run = data.runs.find((r) => r.sessionId === props.sessionId);
      const view = props.useStore((s) => s.view);
      const step = data.stepSessions?.find((s) => s.sessionId === props.sessionId);
      if (step) return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RunTimeline, { ctx, api, runId: step.runId, focusNodeId: step.nodeId, openSession, onChange: refresh, embedded: true, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Native, { ...props }) });
      if (!run) return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Native, { ...props });
      if (view === "trajectory") return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Native, { ...props });
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(RunTimeline, { ctx, api, runId: run.id, openSession, onChange: refresh, embedded: true }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "wf-root-conversation", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { children: "\u603B\u4F1A\u8BDD\u4EA4\u6D41" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Native, { ...props })
        ] })
      ] });
    };
    native.component = Wrapped;
    return () => {
      if (native.component === Wrapped) native.component = Native;
    };
  });
  ctx.slots.inject(
    "conversation.input.left",
    () => ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "workflow-binding",
        order: 15,
        inject: (sessionId) => ({ sessionId })
      },
      BindingTag
    )
  );
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      { name: "shell.overlay", id: "workflow-studio-picker" },
      Picker
    )
  );
  ctx.slots.inject(
    "sidebar.panellist",
    () => ctx.slots.register(
      { name: "sidebar.panellist", id: "workflow-studio", order: 100, label: "\u5DE5\u4F5C\u6D41" },
      ({ size, active }) => {
        (0, import_react11.useEffect)(() => {
          if (active) {
            setPanelOpen(true);
            void refresh();
          }
        }, [active]);
        return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GitBranch, { size, strokeWidth: 1.8, "aria-hidden": "true" });
      }
    )
  );
  ctx.commandUi.register({
    name: "workflow",
    description: () => "\u521B\u5EFA\u5DE5\u4F5C\u6D41\u3001\u4FEE\u6539\u5DE5\u4F5C\u6D41\uFF0C\u6216\u9009\u62E9\u5DE5\u4F5C\u6D41\u5F00\u59CB\u8FD0\u884C",
    available: () => true,
    ui: {
      kind: "popupSelect",
      options: async () => {
        await refresh();
        const items = [
          {
            id: "create",
            label: "\u521B\u5EFA\u5DE5\u4F5C\u6D41",
            detail: "\u901A\u8FC7\u5BF9\u8BDD\u63CF\u8FF0\u76EE\u6807\uFF0CAgent \u81EA\u52A8\u751F\u6210\u6B65\u9AA4\u5B9A\u4E49"
          }
        ];
        for (const workflow of snapshot.workflows.filter((w) => !w.archived)) {
          const version = workflow.published ?? workflow.revision;
          items.push({
            id: `run:${workflow.id}`,
            label: `\u8FD0\u884C\u300C${workflow.name}\u300D`,
            detail: `v${version} \xB7 \u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD\uFF0C\u4E0B\u4E00\u6761\u6D88\u606F\u5F00\u59CB\u8FD0\u884C`,
            active: snapshot.bindings.some(
              (item) => item.workflowId === workflow.id && item.mode === "run"
            )
          });
          items.push({
            id: `modify:${workflow.id}`,
            label: `\u4FEE\u6539\u300C${workflow.name}\u300D`,
            detail: `v${workflow.revision} \xB7 \u5F00\u59CB\u4E00\u4E2A\u5BF9\u8BDD\u4FEE\u6539\u4F1A\u8BDD`
          });
        }
        return items;
      },
      onSelect: async (option, session) => {
        if (option.id === "create") {
          await beginAuthorSession(session.sessionId);
          return;
        }
        const [action, id2] = option.id.split(":");
        const workflow = snapshot.workflows.find((w) => w.id === id2);
        if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
        const authoring = action === "modify";
        await bind(
          workflow,
          authoring ? void 0 : session.sessionId,
          authoring ? "author" : "run"
        );
      }
    }
  });
  ctx.effect(() => {
    let timer2;
    const poll = async () => {
      if (!document.hidden && panelOpen) await refresh();
      if (!stopped) timer2 = setTimeout(poll, 2e3);
    };
    void refresh();
    void poll();
    if (window.innerWidth < 700) {
      try {
        ctx.layout.toggleSidebar();
      } catch {
      }
    }
    if (panelOpen) {
      try {
        ctx.layout.selectPanel("workflow-studio");
      } catch {
      }
    }
    const resize = () => {
      if (document.querySelector(".wf-main")) fitNarrowPanel();
    };
    window.addEventListener("resize", resize);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      lifetime.abort();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visible);
      clearTimeout(timer2);
    };
  });
}
/*! Bundled license information:

use-sync-external-store/cjs/use-sync-external-store-shim.development.js:
  (**
   * @license React
   * use-sync-external-store-shim.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js:
  (**
   * @license React
   * use-sync-external-store-shim/with-selector.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

lucide-react/dist/esm/shared/src/utils.js:
lucide-react/dist/esm/defaultAttributes.js:
lucide-react/dist/esm/Icon.js:
lucide-react/dist/esm/createLucideIcon.js:
lucide-react/dist/esm/icons/archive-restore.js:
lucide-react/dist/esm/icons/archive.js:
lucide-react/dist/esm/icons/arrow-left.js:
lucide-react/dist/esm/icons/book-open.js:
lucide-react/dist/esm/icons/check-check.js:
lucide-react/dist/esm/icons/check.js:
lucide-react/dist/esm/icons/chevron-down.js:
lucide-react/dist/esm/icons/chevron-right.js:
lucide-react/dist/esm/icons/clipboard-paste.js:
lucide-react/dist/esm/icons/clock.js:
lucide-react/dist/esm/icons/code.js:
lucide-react/dist/esm/icons/copy.js:
lucide-react/dist/esm/icons/download.js:
lucide-react/dist/esm/icons/ellipsis.js:
lucide-react/dist/esm/icons/external-link.js:
lucide-react/dist/esm/icons/file-text.js:
lucide-react/dist/esm/icons/git-branch.js:
lucide-react/dist/esm/icons/layout-grid.js:
lucide-react/dist/esm/icons/list.js:
lucide-react/dist/esm/icons/loader-circle.js:
lucide-react/dist/esm/icons/message-square.js:
lucide-react/dist/esm/icons/panels-top-left.js:
lucide-react/dist/esm/icons/paperclip.js:
lucide-react/dist/esm/icons/pause.js:
lucide-react/dist/esm/icons/pencil.js:
lucide-react/dist/esm/icons/play.js:
lucide-react/dist/esm/icons/plus.js:
lucide-react/dist/esm/icons/refresh-cw.js:
lucide-react/dist/esm/icons/save.js:
lucide-react/dist/esm/icons/search.js:
lucide-react/dist/esm/icons/send.js:
lucide-react/dist/esm/icons/settings-2.js:
lucide-react/dist/esm/icons/skip-forward.js:
lucide-react/dist/esm/icons/sparkles.js:
lucide-react/dist/esm/icons/square.js:
lucide-react/dist/esm/icons/step-forward.js:
lucide-react/dist/esm/icons/text-cursor-input.js:
lucide-react/dist/esm/icons/trash-2.js:
lucide-react/dist/esm/icons/triangle-alert.js:
lucide-react/dist/esm/icons/undo-2.js:
lucide-react/dist/esm/icons/upload.js:
lucide-react/dist/esm/icons/workflow.js:
lucide-react/dist/esm/icons/x.js:
lucide-react/dist/esm/lucide-react.js:
  (**
   * @license lucide-react v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/

return module.exports;}});
