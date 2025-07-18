import PDFDocument from '../PDFDocument';
import PDFPage from '../PDFPage';
import PDFFont from '../PDFFont';
import PDFImage from '../PDFImage';
import PDFField, { FieldAppearanceOptions, assertFieldAppearanceOptions } from './PDFField';
import {
  AppearanceProviderFor,
  normalizeAppearance,
  defaultTextFieldAppearanceProvider,
} from './appearances';
import { rgb } from '../colors';
import { degrees } from '../rotations';
import { RichTextFieldReadError, ExceededMaxLengthError, InvalidMaxLengthError } from '../errors';
import { ImageAlignment } from '../image/alignment';
import { TextAlignment } from '../text/alignment';

import {
  PDFHexString,
  PDFRef,
  PDFStream,
  PDFAcroText,
  AcroTextFlags,
  PDFWidgetAnnotation,
} from '../../core';
import {
  assertIs,
  assertIsOneOf,
  assertOrUndefined,
  assertPositive,
  assertRangeOrUndefined,
} from '../../utils';

/**
 * Represents a text field of a [[PDFForm]].
 *
 * [[PDFTextField]] fields are boxes that display text entered by the user. The
 * purpose of a text field is to enable users to enter text or view text values
 * in the document prefilled by software. Users can click on a text field and
 * input text via their keyboard. Some text fields allow multiple lines of text
 * to be entered (see [[PDFTextField.isMultiline]]).
 */
export default class PDFTextField extends PDFField {
  /**
   * > **NOTE:** You probably don't want to call this method directly. Instead,
   * > consider using the [[PDFForm.getTextField]] method, which will create an
   * > instance of [[PDFTextField]] for you.
   *
   * Create an instance of [[PDFTextField]] from an existing acroText and ref
   *
   * @param acroText The underlying `PDFAcroText` for this text field.
   * @param ref The unique reference for this text field.
   * @param doc The document to which this text field will belong.
   */
  static of = (acroText: PDFAcroText, ref: PDFRef, doc: PDFDocument) =>
    new PDFTextField(acroText, ref, doc);

  /** The low-level PDFAcroText wrapped by this text field. */
  readonly acroField: PDFAcroText;

  private constructor(acroText: PDFAcroText, ref: PDFRef, doc: PDFDocument) {
    super(acroText, ref, doc);

    assertIs(acroText, 'acroText', [[PDFAcroText, 'PDFAcroText']]);

    this.acroField = acroText;
  }

  /**
   * Get the text that this field contains. This text is visible to users who
   * view this field in a PDF reader.
   *
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * const text = textField.getText()
   * console.log('Text field contents:', text)
   * ```
   *
   * Note that if this text field contains no underlying value, `undefined`
   * will be returned. Text fields may also contain an underlying value that
   * is simply an empty string (`''`). This detail is largely irrelevant for
   * most applications. In general, you'll want to treat both cases the same
   * way and simply consider the text field to be empty. In either case, the
   * text field will appear empty to users when viewed in a PDF reader.
   *
   * An error will be thrown if this is a rich text field. `pdf-lib` does not
   * support reading rich text fields. Nor do most PDF readers and writers.
   * Rich text fields are based on XFA (XML Forms Architecture). Relatively few
   * PDFs use rich text fields or XFA. Unlike PDF itself, XFA is not an ISO
   * standard. XFA has been deprecated in PDF 2.0:
   * * https://en.wikipedia.org/wiki/XFA
   * * http://blog.pdfshareforms.com/pdf-2-0-release-bid-farewell-xfa-forms/
   *
   * @returns The text contained in this text field.
   */
  getText(): string | undefined {
    const value = this.acroField.getValue();
    if (!value && this.isRichFormatted()) {
      throw new RichTextFieldReadError(this.getName());
    }
    return value?.decodeText();
  }

  /**
   * Set the text for this field. This operation is analogous to a human user
   * clicking on the text field in a PDF reader and typing in text via their
   * keyboard. This method will update the underlying state of the text field
   * to indicate what text has been set. PDF libraries and readers will be able
   * to extract these values from the saved document and determine what text
   * was set.
   *
   * For example:
   * ```js
   * const textField = form.getTextField('best.superhero.text.field')
   * textField.setText('One Punch Man')
   * ```
   *
   * This method will mark this text field as dirty, causing its appearance
   * streams to be updated when either [[PDFDocument.save]] or
   * [[PDFForm.updateFieldAppearances]] is called. The updated streams will
   * display the text this field contains inside the widgets of this text
   * field.
   *
   * **IMPORTANT:** The default font used to update appearance streams is
   * [[StandardFonts.Helvetica]]. Note that this is a WinAnsi font. This means
   * that encoding errors will be thrown if this field contains text outside
   * the WinAnsi character set (the latin alphabet).
   *
   * Embedding a custom font and passing it to
   * [[PDFForm.updateFieldAppearances]] or [[PDFTextField.updateAppearances]]
   * allows you to generate appearance streams with characters outside the
   * latin alphabet (assuming the custom font supports them).
   *
   * If this is a rich text field, it will be converted to a standard text
   * field in order to set the text. `pdf-lib` does not support writing rich
   * text strings. Nor do most PDF readers and writers. See
   * [[PDFTextField.getText]] for more information about rich text fields and
   * their deprecation in PDF 2.0.
   *
   * @param text The text this field should contain.
   */
  setText(text: string | undefined) {
    assertOrUndefined(text, 'text', ['string']);

    const maxLength = this.getMaxLength();
    if (maxLength !== undefined && text && text.length > maxLength) {
      throw new ExceededMaxLengthError(text.length, maxLength, this.getName());
    }

    this.markAsDirty();
    this.disableRichFormatting();

    if (text) {
      this.acroField.setValue(PDFHexString.fromText(text));
    } else {
      this.acroField.removeValue();
    }
  }

  /**
   * Get the alignment for this text field. This value represents the
   * justification of the text when it is displayed to the user in PDF readers.
   * There are three possible alignments: left, center, and right. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * const alignment = textField.getAlignment()
   * if (alignment === TextAlignment.Left) console.log('Text is left justified')
   * if (alignment === TextAlignment.Center) console.log('Text is centered')
   * if (alignment === TextAlignment.Right) console.log('Text is right justified')
   * ```
   * @returns The alignment of this text field.
   */
  getAlignment(): TextAlignment {
    const quadding = this.acroField.getQuadding();

    // prettier-ignore
    return (
        quadding === 0 ? TextAlignment.Left
      : quadding === 1 ? TextAlignment.Center
      : quadding === 2 ? TextAlignment.Right
      : TextAlignment.Left
    );
  }

  /**
   * Set the alignment for this text field. This will determine the
   * justification of the text when it is displayed to the user in PDF readers.
   * There are three possible alignments: left, center, and right. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   *
   * // Text will be left justified when displayed
   * textField.setAlignment(TextAlignment.Left)
   *
   * // Text will be centered when displayed
   * textField.setAlignment(TextAlignment.Center)
   *
   * // Text will be right justified when displayed
   * textField.setAlignment(TextAlignment.Right)
   * ```
   * This method will mark this text field as dirty. See
   * [[PDFTextField.setText]] for more details about what this means.
   * @param alignment The alignment for this text field.
   */
  setAlignment(alignment: TextAlignment) {
    assertIsOneOf(alignment, 'alignment', TextAlignment);
    this.markAsDirty();
    this.acroField.setQuadding(alignment);
  }

  /**
   * Get the maximum length of this field. This value represents the maximum
   * number of characters that can be typed into this field by the user. If
   * this field does not have a maximum length, `undefined` is returned.
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * const maxLength = textField.getMaxLength()
   * if (maxLength === undefined) console.log('No max length')
   * else console.log(`Max length is ${maxLength}`)
   * ```
   * @returns The maximum number of characters allowed in this field, or
   *          `undefined` if no limit exists.
   */
  getMaxLength(): number | undefined {
    return this.acroField.getMaxLength();
  }

  /**
   * Set the maximum length of this field. This limits the number of characters
   * that can be typed into this field by the user. This also limits the length
   * of the string that can be passed to [[PDFTextField.setText]]. This limit
   * can be removed by passing `undefined` as `maxLength`. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   *
   * // Allow between 0 and 5 characters to be entered
   * textField.setMaxLength(5)
   *
   * // Allow any number of characters to be entered
   * textField.setMaxLength(undefined)
   * ```
   * This method will mark this text field as dirty. See
   * [[PDFTextField.setText]] for more details about what this means.
   * @param maxLength The maximum number of characters allowed in this field, or
   *                  `undefined` to remove the limit.
   */
  setMaxLength(maxLength?: number) {
    assertRangeOrUndefined(maxLength, 'maxLength', 0, Number.MAX_SAFE_INTEGER);

    this.markAsDirty();

    if (maxLength === undefined) {
      this.acroField.removeMaxLength();
    } else {
      const text = this.getText();
      if (text && text.length > maxLength) {
        throw new InvalidMaxLengthError(text.length, maxLength, this.getName());
      }
      this.acroField.setMaxLength(maxLength);
    }
  }

  /**
   * Remove the maximum length for this text field. This allows any number of
   * characters to be typed into this field by the user. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.removeMaxLength()
   * ```
   * Calling this method is equivalent to passing `undefined` to
   * [[PDFTextField.setMaxLength]].
   */
  removeMaxLength() {
    this.markAsDirty();
    this.acroField.removeMaxLength();
  }

  /**
   * Display an image inside the bounds of this text field's widgets. For example:
   * ```js
   * const pngImage = await pdfDoc.embedPng(...)
   * const textField = form.getTextField('some.text.field')
   * textField.setImage(pngImage)
   * ```
   * This will update the appearances streams for each of this text field's widgets.
   * @param image The image that should be displayed.
   */
  setImage(image: PDFImage) {
    const fieldAlignment = this.getAlignment();

    // prettier-ignore
    const alignment = 
        fieldAlignment === TextAlignment.Center ? ImageAlignment.Center
      : fieldAlignment === TextAlignment.Right ? ImageAlignment.Right
      : ImageAlignment.Left;

    const widgets = this.acroField.getWidgets();
    for (let idx = 0, len = widgets.length; idx < len; idx++) {
      const widget = widgets[idx];
      const streamRef = this.createImageAppearanceStream(widget, image, alignment);
      this.updateWidgetAppearances(widget, { normal: streamRef });
    }

    this.markAsClean();
  }

  /**
   * Set the font size for this field. Larger font sizes will result in larger
   * text being displayed when PDF readers render this text field. Font sizes
   * may be integer or floating point numbers. Supplying a negative font size
   * will cause this method to throw an error.
   *
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.setFontSize(4)
   * textField.setFontSize(15.7)
   * ```
   *
   * > This method depends upon the existence of a default appearance
   * > (`/DA`) string. If this field does not have a default appearance string,
   * > or that string does not contain a font size (via the `Tf` operator),
   * > then this method will throw an error.
   *
   * @param fontSize The font size to be used when rendering text in this field.
   */
  setFontSize(fontSize: number) {
    assertPositive(fontSize, 'fontSize');
    this.acroField.setFontSize(fontSize);
    this.markAsDirty();
  }

  /**
   * Returns `true` if each line of text is shown on a new line when this
   * field is displayed in a PDF reader. The alternative is that all lines of
   * text are merged onto a single line when displayed. See
   * [[PDFTextField.enableMultiline]] and [[PDFTextField.disableMultiline]].
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.isMultiline()) console.log('Multiline is enabled')
   * ```
   * @returns Whether or not this is a multiline text field.
   */
  isMultiline(): boolean {
    return this.acroField.hasFlag(AcroTextFlags.Multiline);
  }

  /**
   * Display each line of text on a new line when this field is displayed in a
   * PDF reader. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.enableMultiline()
   * ```
   * This method will mark this text field as dirty. See
   * [[PDFTextField.setText]] for more details about what this means.
   */
  enableMultiline() {
    this.markAsDirty();
    this.acroField.setFlagTo(AcroTextFlags.Multiline, true);
  }

  /**
   * Display each line of text on the same line when this field is displayed
   * in a PDF reader. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.disableMultiline()
   * ```
   * This method will mark this text field as dirty. See
   * [[PDFTextField.setText]] for more details about what this means.
   */
  disableMultiline() {
    this.markAsDirty();
    this.acroField.setFlagTo(AcroTextFlags.Multiline, false);
  }

  /**
   * Returns `true` if this is a password text field. This means that the field
   * is intended for storing a secure password. See
   * [[PDFTextField.enablePassword]] and [[PDFTextField.disablePassword]].
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.isPassword()) console.log('Password is enabled')
   * ```
   * @returns Whether or not this is a password text field.
   */
  isPassword(): boolean {
    return this.acroField.hasFlag(AcroTextFlags.Password);
  }

  /**
   * Indicate that this text field is intended for storing a secure password.
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.enablePassword()
   * ```
   * Values entered into password text fields should not be displayed on the
   * screen by PDF readers. Most PDF readers will display the value as
   * asterisks or bullets. PDF readers should never store values entered by the
   * user into password text fields. Similarly, applications should not
   * write data to a password text field.
   *
   * **Please note that this method does not cause entered values to be
   * encrypted or secured in any way! It simply sets a flag that PDF software
   * and readers can access to determine the _purpose_ of this field.**
   */
  enablePassword() {
    this.acroField.setFlagTo(AcroTextFlags.Password, true);
  }

  /**
   * Indicate that this text field is **not** intended for storing a secure
   * password. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.disablePassword()
   * ```
   */
  disablePassword() {
    this.acroField.setFlagTo(AcroTextFlags.Password, false);
  }

  /**
   * Returns `true` if the contents of this text field represent a file path.
   * See [[PDFTextField.enableFileSelection]] and
   * [[PDFTextField.disableFileSelection]]. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.isFileSelector()) console.log('Is a file selector')
   * ```
   * @returns Whether or not this field should contain file paths.
   */
  isFileSelector(): boolean {
    return this.acroField.hasFlag(AcroTextFlags.FileSelect);
  }

  /**
   * Indicate that this text field is intended to store a file path. The
   * contents of the file stored at that path should be submitted as the value
   * of the field. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.enableFileSelection()
   * ```
   */
  enableFileSelection() {
    this.acroField.setFlagTo(AcroTextFlags.FileSelect, true);
  }

  /**
   * Indicate that this text field is **not** intended to store a file path.
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.disableFileSelection()
   * ```
   */
  disableFileSelection() {
    this.acroField.setFlagTo(AcroTextFlags.FileSelect, false);
  }

  /**
   * Returns `true` if the text entered in this field should be spell checked
   * by PDF readers. See [[PDFTextField.enableSpellChecking]] and
   * [[PDFTextField.disableSpellChecking]]. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.isSpellChecked()) console.log('Spell checking is enabled')
   * ```
   * @returns Whether or not this field should be spell checked.
   */
  isSpellChecked(): boolean {
    return !this.acroField.hasFlag(AcroTextFlags.DoNotSpellCheck);
  }

  /**
   * Allow PDF readers to spell check the text entered in this field.
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.enableSpellChecking()
   * ```
   */
  enableSpellChecking() {
    this.acroField.setFlagTo(AcroTextFlags.DoNotSpellCheck, false);
  }

  /**
   * Do not allow PDF readers to spell check the text entered in this field.
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.disableSpellChecking()
   * ```
   */
  disableSpellChecking() {
    this.acroField.setFlagTo(AcroTextFlags.DoNotSpellCheck, true);
  }

  /**
   * Returns `true` if PDF readers should allow the user to scroll the text
   * field when its contents do not fit within the field's view bounds. See
   * [[PDFTextField.enableScrolling]] and [[PDFTextField.disableScrolling]].
   * For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.isScrollable()) console.log('Scrolling is enabled')
   * ```
   * @returns Whether or not the field is scrollable in PDF readers.
   */
  isScrollable(): boolean {
    return !this.acroField.hasFlag(AcroTextFlags.DoNotScroll);
  }

  /**
   * Allow PDF readers to present a scroll bar to the user when the contents
   * of this text field do not fit within its view bounds. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.enableScrolling()
   * ```
   * A horizontal scroll bar should be shown for singleline fields. A vertical
   * scroll bar should be shown for multiline fields.
   */
  enableScrolling() {
    this.acroField.setFlagTo(AcroTextFlags.DoNotScroll, false);
  }

  /**
   * Do not allow PDF readers to present a scroll bar to the user when the
   * contents of this text field do not fit within its view bounds. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.disableScrolling()
   * ```
   */
  disableScrolling() {
    this.acroField.setFlagTo(AcroTextFlags.DoNotScroll, true);
  }

  /**
   * Returns `true` if this is a combed text field. This means that the field
   * is split into `n` equal size cells with one character in each (where `n`
   * is equal to the max length of the text field). The result is that all
   * characters in this field are displayed an equal distance apart from one
   * another. See [[PDFTextField.enableCombing]] and
   * [[PDFTextField.disableCombing]]. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.isCombed()) console.log('Combing is enabled')
   * ```
   * Note that in order for a text field to be combed, the following must be
   * true (in addition to enabling combing):
   * * It must not be a multiline field (see [[PDFTextField.isMultiline]])
   * * It must not be a password field (see [[PDFTextField.isPassword]])
   * * It must not be a file selector field (see [[PDFTextField.isFileSelector]])
   * * It must have a max length defined (see [[PDFTextField.setMaxLength]])
   * @returns Whether or not this field is combed.
   */
  isCombed(): boolean {
    return (
      this.acroField.hasFlag(AcroTextFlags.Comb) &&
      !this.isMultiline() &&
      !this.isPassword() &&
      !this.isFileSelector() &&
      this.getMaxLength() !== undefined
    );
  }

  /**
   * Split this field into `n` equal size cells with one character in each
   * (where `n` is equal to the max length of the text field). This will cause
   * all characters in the field to be displayed an equal distance apart from
   * one another. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.enableCombing()
   * ```
   *
   * In addition to calling this method, text fields must have a max length
   * defined in order to be combed (see [[PDFTextField.setMaxLength]]).
   *
   * This method will also call the following three methods internally:
   * * [[PDFTextField.disableMultiline]]
   * * [[PDFTextField.disablePassword]]
   * * [[PDFTextField.disableFileSelection]]
   *
   * This method will mark this text field as dirty. See
   * [[PDFTextField.setText]] for more details about what this means.
   */
  enableCombing() {
    if (this.getMaxLength() === undefined) {
      const msg = `PDFTextFields must have a max length in order to be combed`;
      console.warn(msg);
    }

    this.markAsDirty();

    this.disableMultiline();
    this.disablePassword();
    this.disableFileSelection();

    this.acroField.setFlagTo(AcroTextFlags.Comb, true);
  }

  /**
   * Turn off combing for this text field. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.disableCombing()
   * ```
   * See [[PDFTextField.isCombed]] and [[PDFTextField.enableCombing]] for more
   * information about what combing is.
   *
   * This method will mark this text field as dirty. See
   * [[PDFTextField.setText]] for more details about what this means.
   */
  disableCombing() {
    this.markAsDirty();
    this.acroField.setFlagTo(AcroTextFlags.Comb, false);
  }

  /**
   * Returns `true` if this text field contains rich text. See
   * [[PDFTextField.enableRichFormatting]] and
   * [[PDFTextField.disableRichFormatting]]. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.isRichFormatted()) console.log('Rich formatting enabled')
   * ```
   * @returns Whether or not this field contains rich text.
   */
  isRichFormatted(): boolean {
    return this.acroField.hasFlag(AcroTextFlags.RichText);
  }

  /**
   * Indicate that this field contains XFA data - or rich text. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.enableRichFormatting()
   * ```
   * Note that `pdf-lib` does not support reading or writing rich text fields.
   * Nor do most PDF readers and writers. Rich text fields are based on XFA
   * (XML Forms Architecture). Relatively few PDFs use rich text fields or XFA.
   * Unlike PDF itself, XFA is not an ISO standard. XFA has been deprecated in
   * PDF 2.0:
   * * https://en.wikipedia.org/wiki/XFA
   * * http://blog.pdfshareforms.com/pdf-2-0-release-bid-farewell-xfa-forms/
   */
  enableRichFormatting() {
    this.acroField.setFlagTo(AcroTextFlags.RichText, true);
  }

  /**
   * Indicate that this is a standard text field that does not XFA data (rich
   * text). For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * textField.disableRichFormatting()
   * ```
   */
  disableRichFormatting() {
    this.acroField.setFlagTo(AcroTextFlags.RichText, false);
  }

  /**
   * Show this text field on the specified page. For example:
   * ```js
   * const ubuntuFont = await pdfDoc.embedFont(ubuntuFontBytes)
   * const page = pdfDoc.addPage()
   *
   * const form = pdfDoc.getForm()
   * const textField = form.createTextField('best.gundam')
   * textField.setText('Exia')
   *
   * textField.addToPage(page, {
   *   x: 50,
   *   y: 75,
   *   width: 200,
   *   height: 100,
   *   textColor: rgb(1, 0, 0),
   *   backgroundColor: rgb(0, 1, 0),
   *   borderColor: rgb(0, 0, 1),
   *   borderWidth: 2,
   *   rotate: degrees(90),
   *   font: ubuntuFont,
   * })
   * ```
   * This will create a new widget for this text field.
   * @param page The page to which this text field widget should be added.
   * @param options The options to be used when adding this text field widget.
   */
  addToPage(page: PDFPage, options?: FieldAppearanceOptions) {
    assertIs(page, 'page', [[PDFPage, 'PDFPage']]);
    assertFieldAppearanceOptions(options);

    if (!options) options = {};

    if (!('textColor' in options)) options.textColor = rgb(0, 0, 0);
    if (!('backgroundColor' in options)) options.backgroundColor = rgb(1, 1, 1);
    if (!('borderColor' in options)) options.borderColor = rgb(0, 0, 0);
    if (!('borderWidth' in options)) options.borderWidth = 1;

    // Create a widget for this text field
    const widget = this.createWidget({
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 200,
      height: options.height ?? 50,
      textColor: options.textColor,
      backgroundColor: options.backgroundColor,
      borderColor: options.borderColor,
      borderWidth: options.borderWidth ?? 0,
      rotate: options.rotate ?? degrees(0),
      hidden: options.hidden,
      page: page.ref,
    });
    const widgetRef = this.doc.context.register(widget.dict);

    // Add widget to this field
    this.acroField.addWidget(widgetRef);

    // Set appearance streams for widget
    const font = options.font ?? this.doc.getForm().getDefaultFont();
    this.updateWidgetAppearance(widget, font);

    // Add widget to the given page
    page.node.addAnnot(widgetRef);
  }

  /**
   * Returns `true` if this text field has been marked as dirty, or if any of
   * this text field's widgets do not have an appearance stream. For example:
   * ```js
   * const textField = form.getTextField('some.text.field')
   * if (textField.needsAppearancesUpdate()) console.log('Needs update')
   * ```
   * @returns Whether or not this text field needs an appearance update.
   */
  needsAppearancesUpdate(): boolean {
    if (this.isDirty()) return true;

    const widgets = this.acroField.getWidgets();
    for (let idx = 0, len = widgets.length; idx < len; idx++) {
      const widget = widgets[idx];
      const hasAppearances = widget.getAppearances()?.normal instanceof PDFStream;
      if (!hasAppearances) return true;
    }

    return false;
  }

  /**
   * Update the appearance streams for each of this text field's widgets using
   * the default appearance provider for text fields. For example:
   * ```js
   * const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const textField = form.getTextField('some.text.field')
   * textField.defaultUpdateAppearances(helvetica)
   * ```
   * @param font The font to be used for creating the appearance streams.
   */
  defaultUpdateAppearances(font: PDFFont) {
    assertIs(font, 'font', [[PDFFont, 'PDFFont']]);
    this.updateAppearances(font);
  }

  /**
   * Update the appearance streams for each of this text field's widgets using
   * the given appearance provider. If no `provider` is passed, the default
   * appearance provider for text fields will be used. For example:
   * ```js
   * const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
   * const textField = form.getTextField('some.text.field')
   * textField.updateAppearances(helvetica, (field, widget, font) => {
   *   ...
   *   return drawTextField(...)
   * })
   * ```
   * @param font The font to be used for creating the appearance streams.
   * @param provider Optionally, the appearance provider to be used for
   *                 generating the contents of the appearance streams.
   */
  updateAppearances(font: PDFFont, provider?: AppearanceProviderFor<PDFTextField>) {
    assertIs(font, 'font', [[PDFFont, 'PDFFont']]);
    assertOrUndefined(provider, 'provider', [Function]);

    const widgets = this.acroField.getWidgets();
    for (let idx = 0, len = widgets.length; idx < len; idx++) {
      const widget = widgets[idx];
      this.updateWidgetAppearance(widget, font, provider);
    }
    this.markAsClean();
  }

  private updateWidgetAppearance(
    widget: PDFWidgetAnnotation,
    font: PDFFont,
    provider?: AppearanceProviderFor<PDFTextField>,
  ) {
    const apProvider = provider ?? defaultTextFieldAppearanceProvider;
    const appearances = normalizeAppearance(apProvider(this, widget, font));
    this.updateWidgetAppearanceWithFont(widget, font, appearances);
  }
}
