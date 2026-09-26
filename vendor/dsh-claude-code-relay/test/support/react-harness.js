import { readFileSync } from "node:fs";

// A minimal React stand-in, proven against the shipped bundle: enough hooks to run the Settings
// page, with element objects kept plain so tests can walk the tree. No DOM.
export function makeReact() {
  const state = [];
  const refs = [];
  let cursor = 0;
  let effects = [];
  let tree = null;
  let render = null;
  let renders = 0;

  const react = {
    // A function type is a component: React calls it and keeps the returned element. Without this
    // the tree would hold the component itself and never its markup, and every nested control
    // (checkboxes, labeled fields) would be invisible to a walk.
    createElement: (type, props, ...children) => {
      const elementProps = { ...(props ?? {}) };
      if (children.length > 0) elementProps.children = children.flat();
      if (typeof type === "function") return type(elementProps);
      return { type, props: elementProps, children: children.flat() };
    },
    useState(initial) {
      const i = cursor++;
      if (state[i] === undefined) state[i] = typeof initial === "function" ? initial() : initial;
      return [state[i], (next) => {
        const value = typeof next === "function" ? next(state[i]) : next;
        // React bails out when the value is unchanged; matching that stops a polling component
        // from re-rendering forever in the harness.
        if (Object.is(value, state[i])) return;
        state[i] = value;
        if (render) render();
      }];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      refs.deps = refs.deps ?? {};
      const previous = refs.deps[i];
      const same =
        Array.isArray(deps) && Array.isArray(previous) &&
        deps.length === previous.length && deps.every((d, k) => Object.is(d, previous[k]));
      refs.deps[i] = deps;
      if (!same) effects.push({ fn });
    },
    useCallback(fn) { cursor++; return fn; },
    useMemo(fn) { cursor++; return fn(); },
    useRef(initial) {
      const i = cursor++;
      if (refs[i] === undefined) refs[i] = { current: initial };
      return refs[i];
    },
    useSyncExternalStore(_subscribe, getSnapshot) { cursor++; return getSnapshot(); },
    __render(Component, props) {
      if (++renders > 100) throw new Error("render loop: the component never settled");
      render = () => react.__render(Component, props);
      cursor = 0;
      effects = [];
      tree = Component(props);
      return tree;
    },
    /** Run every effect the renders queued, until state and effects both settle. */
    async __flush() {
      for (let guard = 0; guard < 20 && effects.length > 0; guard++) {
        const pending = effects;
        effects = [];
        for (const { fn } of pending) fn();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      return tree;
    },
  };
  // The tree the most recent render produced. A getter rather than a field, because a state update
  // re-renders and replaces it after any value read during the same tick would have gone stale.
  Object.defineProperty(react, "tree", { get: () => tree });
  return react;
}

/** Every string rendered anywhere in the tree. */
export function textOf(node, out = []) {
  if (node == null || node === false) return out;
  if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const child of node) textOf(child, out); return out; }
  for (const child of node.children ?? []) textOf(child, out);
  return out;
}

/** Every element of one type in the tree. Children may be nested arrays — `createElement` flattens
 *  one level, and a component returning an array of elements keeps them — so this walks both. */
export function findAll(node, type, out = []) {
  if (node == null || node === false || typeof node !== "object") return out;
  if (Array.isArray(node)) { for (const child of node) findAll(child, type, out); return out; }
  if (node.type === type) out.push(node);
  findAll(node.children ?? [], type, out);
  return out;
}

/** Load the browser bundle the way dsh's module loader does, returning its client half. */
export function loadClient(bundleUrl) {
  const source = readFileSync(bundleUrl, "utf8");
  let captured;
  const react = makeReact();
  const window = {
    __ModuleLoader__: {
      load({ id, factory }) {
        captured = { id, exports: factory((name) => (name === "react" ? react : undefined)) };
      },
    },
  };
  new Function("window", source)(window);
  return { ...captured, react };
}
