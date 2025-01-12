/* eslint-disable @typescript-eslint/no-namespace */
import { JSX } from 'solid-js/jsx-runtime';
import { createEffect, onCleanup, splitProps } from 'solid-js';
import IMask from 'imask';


// TODO can `directive` be reused here?
// TODO personally hate JSX in libs but seems no way out for solid

const createMaskedInput =
<
  Opts extends IMask.AnyMaskedOptions = IMask.AnyMaskedOptions,
  Value = {
    typedValue: IMask.InputMask<Opts>['typedValue'];
    value: IMask.InputMask<Opts>['value'];
    unmaskedValue: IMask.InputMask<Opts>['unmaskedValue'];
  }
>(
  mask: Opts
) =>
(
  props: Omit<
    JSX.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'onchange'
  > & {
    onAccept?: (
      value: Value,
      maskRef: IMask.InputMask<Opts>,
      e?: InputEvent
    ) => void;
    onComplete?: (
      value: Value,
      maskRef: IMask.InputMask<Opts>,
      e?: InputEvent
    ) => void;
    value?: IMask.InputMask<Opts>['value'];
    unmaskedValue?: IMask.InputMask<Opts>['unmaskedValue'];
  }
) => {
  const [maskProps, inputProps] = splitProps(props, [
    'ref',
    'onAccept',
    'onComplete',
    'value',
    'unmaskedValue',
  ]);
  let m: IMask.InputMask<Opts>;

  createEffect(() => {
    if (m && maskProps.unmaskedValue) {
      m.unmaskedValue = maskProps.unmaskedValue;
    }
  });

  createEffect(() => {
    if (m && maskProps.value) {
      m.value = maskProps.value;
    }
  });

  onCleanup(() => {
    m.destroy();
  });

  return (
    <input
      {...inputProps}
      ref={(el) => {
        m = IMask(el, mask);
        m.on('complete', (e?: InputEvent) => {
          maskProps.onComplete &&
            maskProps.onComplete(
              {
                typedValue: m.typedValue,
                value: m.value,
                unmaskedValue: m.unmaskedValue,
              } as unknown as Value,
              m,
              e
            );
        });
        m.on('accept', (e?: InputEvent) => {
          maskProps.onAccept &&
            maskProps.onAccept(
              {
                typedValue: m.typedValue,
                value: m.value,
                unmaskedValue: m.unmaskedValue,
              } as unknown as Value,
              m,
              e
            );
        });
        maskProps.ref && (maskProps.ref as any)(el);
      }}
      type='string'
    ></input>
  );
};


export default createMaskedInput;
