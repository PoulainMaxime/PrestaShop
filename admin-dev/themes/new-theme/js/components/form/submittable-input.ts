/**
 * Copyright since 2007 PrestaShop SA and Contributors
 * PrestaShop is an International Registered Trademark & Property of PrestaShop SA
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Open Software License (OSL 3.0)
 * that is bundled with this package in the file LICENSE.md.
 * It is also available through the world-wide-web at this URL:
 * https://opensource.org/licenses/OSL-3.0
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@prestashop.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade PrestaShop to newer
 * versions in the future. If you wish to customize PrestaShop for your
 * needs please refer to https://devdocs.prestashop.com/ for more information.
 *
 * @author    PrestaShop SA and Contributors <contact@prestashop.com>
 * @copyright Since 2007 PrestaShop SA and Contributors
 * @license   https://opensource.org/licenses/OSL-3.0 Open Software License (OSL 3.0)
 */

import {showGrowl} from '@app/utils/growl';
import {EventEmitter} from 'events';
import ComponentsEventMap from '@components/components-event-map';
import ComponentsMap from '@components/components-map';

import ClickEvent = JQuery.ClickEvent;

const {$} = window;

export type SubmittableInputConfig = {
  wrapperSelector: string;
  submitCallback: (input: Element) => any;
}

/**
 * Activates, deactivates, shows, hides submit button inside an input
 * (depending if input was changed comparing to initial value)
 * After button is clicked, component fires the callback function which was provided to constructor.
 */
export default class SubmittableInput {
  eventEmitter: EventEmitter;

  inputSelector: string;

  submitCallback: (input: Element) => any;

  wrapperSelector: string;

  inputsInContainerSelector: string;

  buttonSelector: string;

  loading: boolean;

  constructor(config: SubmittableInputConfig) {
    this.eventEmitter = window.prestashop.instance.eventEmitter;
    this.inputSelector = ComponentsMap.submittableInput.inputSelector;
    this.buttonSelector = ComponentsMap.submittableInput.buttonSelector;
    this.wrapperSelector = config.wrapperSelector;
    this.inputsInContainerSelector = `${this.wrapperSelector} ${this.inputSelector}`;
    this.submitCallback = config.submitCallback;
    this.loading = false;

    this.init();
  }

  private init(): void {
    $(document).on('focus', this.inputsInContainerSelector, (e) => {
      this.refreshButtonState(e.currentTarget, true);
    });
    $(document).on('input blur', this.inputsInContainerSelector, (e) => {
      this.refreshButtonState(e.currentTarget);
    });
    $(document).on('click', `${this.wrapperSelector} ${this.buttonSelector}`, (e: ClickEvent) => {
      e.stopImmediatePropagation();
      this.submitInput(this.findInput(e.currentTarget));
    });
    $(document).on('keyup', this.inputsInContainerSelector, (e: JQueryEventObject) => {
      // only on ENTER
      if (e.keyCode !== 13) {
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();
      this.submitInput(e.target as HTMLInputElement);
    });
  }

  private submitInput(input: HTMLInputElement): void {
    if (this.loading || !this.inputValueChanged(input)) {
      return;
    }
    // set local variable to be able to use it inside callback scope
    const {eventEmitter} = this;

    this.toggleLoading(input, true);
    const button = this.findButton(input);

    this.submitCallback(input)
      .then((response: AjaxResponse) => {
        $(input).data('initialValue', input.value);
        this.toggleButtonVisibility(button, false);

        if (response.message) {
          eventEmitter.emit('submittableInputSuccess', input);
          showGrowl('success', response.message);
        }
        this.toggleLoading(input, false);
      })
      .catch((error: AjaxError) => {
        eventEmitter.emit(ComponentsEventMap.submittableInput.submitError, {input, error});
        this.toggleError(button, true);
        this.toggleButtonVisibility(button, false);
        this.toggleLoading(input, false);
        if (typeof error.responseJSON.errors === 'undefined') {
          return;
        }

        const messages = error.responseJSON.errors;
        Object.keys(messages).forEach((key) => {
          showGrowl('error', messages[key]);
        });
      });
  }

  private refreshButtonState(
    input: HTMLElement,
    visible: boolean | null = null,
  ): void {
    const button = this.findButton(input);
    const valueWasChanged = this.inputValueChanged(input);
    this.toggleButtonActivity(button, valueWasChanged);

    if (visible !== null) {
      this.toggleButtonVisibility(button, visible);
    } else {
      this.toggleButtonVisibility(button, valueWasChanged);
    }
  }

  private toggleButtonActivity(button: HTMLElement, active: boolean): void {
    $(button).toggleClass('active', active);
  }

  private toggleButtonVisibility(
    button: Element,
    visible: boolean,
  ): void {
    const $button = $(button);
    $button.toggleClass('d-none', !visible);
  }

  private toggleLoading(input: HTMLInputElement, loading: boolean): void {
    this.loading = loading;
    const button = this.findButton(input);
    // eslint-disable-next-line no-param-reassign
    input.disabled = this.loading;
    button.disabled = this.loading;

    if (this.loading) {
      $(button).html('<span class="spinner-border spinner-border-sm"></span>');
    } else {
      $(button).html('<i class="material-icons">check</i>');
    }
  }

  private toggleError(button: HTMLButtonElement, error: boolean): void {
    const input = this.findInput(button);

    $(input).toggleClass('is-invalid', error);
  }

  private findButton(input: Element): HTMLButtonElement {
    return <HTMLButtonElement>$(input)
      .closest(this.wrapperSelector)
      .find(this.buttonSelector)[0];
  }

  private findInput(button: HTMLButtonElement): HTMLInputElement {
    return <HTMLInputElement>$(button)
      .closest(this.wrapperSelector)
      .find(this.inputSelector)[0];
  }

  private inputValueChanged(input: HTMLElement): boolean {
    const initialValue = $(input).data('initial-value');
    let newValue = $(input).val();

    if ($(input).hasClass('is-invalid')) {
      $(input).removeClass('is-invalid');
    }

    if (typeof initialValue === 'number') {
      newValue = Number(newValue);
    }

    return initialValue !== newValue;
  }
}
