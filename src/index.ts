import { BehaviorSubject, Observable, distinctUntilKeyChanged, pluck, Subscription } from 'rxjs';

export interface ActionWithPayload<StateActions, Payload = unknown> {
  type: StateActions;
  payload: Payload;
}

export interface ActionWithoutPayload<StateActions> {
  type: StateActions;
}

export type Action<StateActions, Payload = void> = Payload extends void
  ? ActionWithoutPayload<StateActions>
  : ActionWithPayload<StateActions, Payload>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReducerFunction<S, StateActions, Payload = any> =
  | ((state: S, action: ActionWithPayload<StateActions, Payload>) => S)
  | ((state: S, action: ActionWithoutPayload<StateActions>) => S);

export interface CreateStoreOptions {
  label: string;
}

class Store<S, StateActions> {
  #state: BehaviorSubject<S>;

  #reducerFns: Map<StateActions, ReducerFunction<S, StateActions>>;

  #options: Partial<CreateStoreOptions>;

  constructor(
    reducerFns: Map<StateActions, ReducerFunction<S, StateActions>>,
    initialState: S,
    options?: Partial<CreateStoreOptions>,
  ) {
    this.#state = new BehaviorSubject(initialState);
    this.#reducerFns = reducerFns;
    this.#options = options ?? {};
  }

  #logger(message: string) {
    const makeLabel = () => `${this.#options.label} >> `;

    // eslint-disable-next-line no-console
    console.log(`${this.#options?.label ? makeLabel() : ''}${message}`);
  }

  #reducer(state: S, action: Action<StateActions, unknown>) {
    this.#logger(`[${action.type}]`);

    const fn = this.#reducerFns.get(action.type);

    if (fn) return fn(state, action);

    return state;
  }

  select<K extends keyof S>(key: K): Observable<S[K]> {
    return this.#state.pipe(distinctUntilKeyChanged(key), pluck(key));
  }

  subscribe(callback: (state: S) => void): Subscription {
    return this.#state.subscribe(callback);
  }

  dispatch = <Payload = void>(action: Action<Payload>): void => {
    const oldState = this.#state.getValue();

    // use of AnyValue because TS can't decide what type of reducer is
    // needed to be used here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newState = this.#reducer(oldState, action as any);

    this.#state.next(newState);
  };

  asyncDispatch = async <Result>(_: StateActions, runner: (state: S) => Promise<Result>): Promise<void> => {
    const currentState = this.#state.getValue();

    const payload: Result = await runner(currentState);

    // @ts-ignore - temp
    const resultAction: ActionWithPayload<StateActions, Result> = { type: 'reset_state', payload };

    this.dispatch(resultAction);
  };

  get value() {
    return this.#state.value;
  }

  resetStore() {
    this.dispatch({ type: 'reset_store' });
  }
}

/**
 * Creates reactive store
 * @param {Map} reducerFns Map object of reducer functions, that take 2 arguments: store and action
 * @param {Object} initialState initial state
 * @param {Object} [options] additional options, like "label" for console messages
 * @returns Store
 * @example
 * ```typescript
 * const MAP = new Map<StateActions, ReducerFunction<State, StateActions>>();
 *
 * MAP.set(StateActions.RESET_STORE, () => ({}));
 * MAP.set(StateActions.ADD_ONE, (state: State, action: ActionWithPayload<StateActions, Flag>) =>
 *  assoc(action.payload.flagId, action.payload.value, state));
 *
 * export const store = createStore(MAP, {}, { label: 'FLAGS_STORE' });
 * ```
 */
export function createStore<S, StateActions>(
  reducerFns: Map<StateActions, ReducerFunction<S, StateActions>>,
  initialState: S,
  options?: Partial<CreateStoreOptions>,
) {
  return new Store<S, StateActions>(reducerFns, initialState, options);
}
