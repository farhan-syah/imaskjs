import IMask from 'imask';
import { isPlatformBrowser } from '@angular/common';
import {
  Directive, ElementRef, Input, Output, forwardRef, Provider, Renderer2,
  EventEmitter, OnDestroy, OnChanges, AfterViewInit,
  SimpleChanges, PLATFORM_ID, inject, InjectionToken
} from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor, COMPOSITION_BUFFER_MODE } from '@angular/forms';
import { IMASK_FACTORY } from './imask-factory-token';

export
type Falsy = false | 0 | "" | null | undefined;

export const MASKEDINPUT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => IMaskDirective),
  multi: true,
};

export const DEFAULT_IMASK_ELEMENT = (elementRef: any) => elementRef.nativeElement;
@Directive({
  selector: '[imask]',
  standalone: true,
  exportAs: 'imask',
  host: {
    '(input)': '_handleInput($event.target.value)',
    '(blur)': 'onTouched()',
    '(compositionstart)': '_compositionStart()',
    '(compositionend)': '_compositionEnd($event.target.value)'
  },
  providers: [MASKEDINPUT_VALUE_ACCESSOR],
})
export class IMaskDirective<
  Opts extends IMask.AnyMaskedOptions,
  Unmask extends ('typed' | boolean) = false,
  Value = Unmask extends 'typed' ? IMask.InputMask<Opts>['typedValue'] :
    Unmask extends Falsy ? IMask.InputMask<Opts>['value'] :
    IMask.InputMask<Opts>['unmaskedValue']
> implements ControlValueAccessor, AfterViewInit, OnDestroy, OnChanges {
  maskRef?: IMask.InputMask<Opts>;
  onTouched: any = () => {};
  onChange: any = () => {};
  private _viewInitialized = false;
  private _initialValue;
  private _composing = false;
  private _writingValue: any;
  private _writing = false;

  private _elementRef = inject(ElementRef);
  private _renderer = inject(Renderer2);
  private _factory = inject(IMASK_FACTORY);
  private _platformId = inject(PLATFORM_ID);
  private _compositionMode = inject(COMPOSITION_BUFFER_MODE, {optional: true}) ?? !this._isAndroid();

  @Input() imask?: Opts;
  @Input() unmask?: Unmask;
  @Input() imaskElement: (elementRef: ElementRef, directiveRef: any) => IMask.MaskElement = DEFAULT_IMASK_ELEMENT;
  @Output() accept = new EventEmitter<Value>();
  @Output() complete = new EventEmitter<Value>();

  get element () {
    return this.imaskElement(this._elementRef, this);
  }

  get maskValue (): Value {
    if (!this.maskRef) return this.element.value as unknown as Value;

    if (this.unmask === 'typed') return this.maskRef.typedValue as unknown as Value;
    if (this.unmask) return this.maskRef.unmaskedValue as unknown as Value;
    return this.maskRef.value as unknown as Value;
  }

  set maskValue (value: Value) {
    if (this.maskRef) {
      if (this.unmask === 'typed') this.maskRef.typedValue = value as unknown as IMask.MaskedTypedValue<Opts['mask']>;
      else if (this.unmask) this.maskRef.unmaskedValue = value as unknown as IMask.InputMask<Opts>['unmaskedValue'];
      else this.maskRef.value = value as unknown as IMask.InputMask<Opts>['value'];
    } else {
      this._renderer.setProperty(this.element, 'value', value);
    }
  }

  ngAfterViewInit() {
    if (this.imask) this.initMask();

    this._viewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['elementRef'] && !this.imaskElement) this.imaskElement = DEFAULT_IMASK_ELEMENT;

    if (!changes['imask'] || !this._viewInitialized) return;

    if (this.imask) {
      if (this.maskRef) this.maskRef.updateOptions(this.imask);
      else {
        this.initMask();
        this.onChange(this.maskValue);
      }
    } else {
      this.destroyMask();
    }
  }

  destroyMask () {
    if (this.maskRef) {
      this.maskRef.destroy();
      delete this.maskRef;
    }
  }

  ngOnDestroy () {
    this.destroyMask();
    this.accept.complete();
    this.complete.complete();
  }

  beginWrite (value: Value): void {
    this._writing = true;
    this._writingValue = value;
  }

  endWrite (): Value {
    this._writing = false;
    return this._writingValue;
  }

  writeValue(value: Value) {
    value = (value == null && this.unmask !== 'typed' ? '' : value) as Value;

    if (this.maskRef) {
      this.beginWrite(value);
      this.maskValue = value;
      this.endWrite();
    } else {
      this._renderer.setProperty(this.element, 'value', value);
      this._initialValue = value;
    }
  }

  _onAccept () {
    const value = this.maskValue;
    // if value was not changed during writing don't fire events
    // for details see https://github.com/uNmAnNeR/imaskjs/issues/136
    if (this._writing && value === this.endWrite()) return;
    this.onChange(value);
    this.accept.emit(value);
  }

  _onComplete () {
    this.complete.emit(this.maskValue);
  }

  private initMask () {
    this.maskRef = this._factory.create(this.element, this.imask)
      .on('accept', this._onAccept.bind(this))
      .on('complete', this._onComplete.bind(this));

    if (this._initialValue != null) this.writeValue(this._initialValue);
    delete this._initialValue;
  }

  setDisabledState (isDisabled: boolean) {
    this._renderer.setProperty(this.element, 'disabled', isDisabled)
  }

  registerOnChange(fn: (_: any) => void): void { this.onChange = fn }
  registerOnTouched(fn: () => void): void { this.onTouched = fn }

  _handleInput(value: any): void {
    // if mask is attached all input goes throw mask
    if (this.maskRef) return;

    if (!this._compositionMode || (this._compositionMode && !this._composing)) {
      this.onChange(value);
    }
  }

  _compositionStart(): void { this._composing = true; }

  _compositionEnd(value: any): void {
    this._composing = false;
    this._compositionMode && this._handleInput(value);
  }

  private _isAndroid(): boolean {
    return isPlatformBrowser(this._platformId) && /android (\d+)/.test(navigator.userAgent.toLowerCase());
  }
}
