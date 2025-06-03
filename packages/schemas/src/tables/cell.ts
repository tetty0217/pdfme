import { DEFAULT_FONT_NAME, Plugin, PDFRenderProps, getFallbackFontName } from '@pdfme/common';
import type { Font as FontKitFont } from 'fontkit';
import { uiRender as textUiRender } from '../text/uiRender.js';
import { pdfRender as textPdfRender } from '../text/pdfRender.js';
import { calculateDynamicFontSize, getFontKitFont } from '../text/helper.js';
import lineShape from '../shapes/line.js';
import { rectangle } from '../shapes/rectAndEllipse.js';
import type { CellSchema } from './types.js';
import { getCellPropPanelSchema, getDefaultCellStyles } from './helper.js';
const linePdfRender = lineShape.pdf;
const rectanglePdfRender = rectangle.pdf;

const renderLine = async (
  arg: PDFRenderProps<CellSchema>,
  schema: CellSchema,
  position: { x: number; y: number },
  width: number,
  height: number,
) =>
  linePdfRender({
    ...arg,
    schema: { ...schema, type: 'line', position, width, height, color: schema.borderColor },
  });

const createTextDiv = (schema: CellSchema) => {
  const { borderWidth: bw, width, height, padding: pd } = schema;
  const textDiv = document.createElement('div');
  textDiv.style.position = 'absolute';
  textDiv.style.zIndex = '1';
  textDiv.style.width = `${width - bw.left - bw.right - pd.left - pd.right}mm`;
  textDiv.style.height = `${height - bw.top - bw.bottom - pd.top - pd.bottom}mm`;
  textDiv.style.top = `${bw.top + pd.top}mm`;
  textDiv.style.left = `${bw.left + pd.left}mm`;
  return textDiv;
};

const createLineDiv = (
  width: string,
  height: string,
  top: string | null,
  right: string | null,
  bottom: string | null,
  left: string | null,
  borderColor: string,
) => {
  const div = document.createElement('div');
  div.style.width = width;
  div.style.height = height;
  div.style.position = 'absolute';
  if (top !== null) div.style.top = top;
  if (right !== null) div.style.right = right;
  if (bottom !== null) div.style.bottom = bottom;
  if (left !== null) div.style.left = left;
  div.style.backgroundColor = borderColor;
  return div;
};

const cellSchema: Plugin<CellSchema> = {
  pdf: async (arg) => {
    const { schema, options, _cache } = arg;
    const { position, width, height, borderWidth, padding } = schema;

    await Promise.all([
      // BACKGROUND
      rectanglePdfRender({
        ...arg,
        schema: {
          ...schema,
          type: 'rectangle',
          width: schema.width,
          height: schema.height,
          borderWidth: 0,
          borderColor: '',
          color: schema.backgroundColor,
        },
      }),
      // TOP
      renderLine(arg, schema, { x: position.x, y: position.y }, width, borderWidth.top),
      // RIGHT
      renderLine(
        arg,
        schema,
        { x: position.x + width - borderWidth.right, y: position.y },
        borderWidth.right,
        height,
      ),
      // BOTTOM
      renderLine(
        arg,
        schema,
        { x: position.x, y: position.y + height - borderWidth.bottom },
        width,
        borderWidth.bottom,
      ),
      // LEFT
      renderLine(arg, schema, { x: position.x, y: position.y }, borderWidth.left, height),
    ]);

    // Calculate dynamic font size if enabled
    let fontSize = schema.fontSize;
    if (schema.dynamicFontSize) {
      const font = options?.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
      const fontName = schema.fontName || getFallbackFontName(font);
      const fontKitFont = await getFontKitFont(
        fontName,
        font,
        _cache as Map<string | number, FontKitFont>,
      );

      const textSchema = {
        name: '',
        type: 'text' as const,
        position: { x: 0, y: 0 },
        width: width - borderWidth.left - borderWidth.right - padding.left - padding.right,
        height: height - borderWidth.top - borderWidth.bottom - padding.top - padding.bottom,
        fontName: schema.fontName,
        alignment: schema.alignment,
        verticalAlignment: schema.verticalAlignment,
        fontSize: schema.fontSize,
        lineHeight: schema.lineHeight,
        characterSpacing: schema.characterSpacing,
        fontColor: schema.fontColor,
        backgroundColor: '',
        dynamicFontSize: schema.dynamicFontSize,
      };

      fontSize = calculateDynamicFontSize({
        textSchema,
        fontKitFont,
        value: schema.content || '',
      });
    }

    // TEXT
    await textPdfRender({
      ...arg,
      schema: {
        ...schema,
        type: 'text',
        backgroundColor: '',
        fontSize,
        position: {
          x: position.x + borderWidth.left + padding.left,
          y: position.y + borderWidth.top + padding.top,
        },
        width: width - borderWidth.left - borderWidth.right - padding.left - padding.right,
        height: height - borderWidth.top - borderWidth.bottom - padding.top - padding.bottom,
      },
    });
  },
  ui: async (arg) => {
    const { schema, rootElement, options, _cache } = arg;
    const { borderWidth, width, height, borderColor, backgroundColor } = schema;
    rootElement.style.backgroundColor = backgroundColor;

    const textDiv = createTextDiv(schema);

    // Calculate dynamic font size for UI rendering if enabled
    let uiSchema = { ...schema, backgroundColor: '' };
    if (schema.dynamicFontSize) {
      const font = options?.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
      const fontName = schema.fontName || getFallbackFontName(font);
      const fontKitFont = await getFontKitFont(
        fontName,
        font,
        _cache as Map<string | number, FontKitFont>,
      );

      const textSchema = {
        name: '',
        type: 'text' as const,
        position: { x: 0, y: 0 },
        width:
          width - borderWidth.left - borderWidth.right - schema.padding.left - schema.padding.right,
        height:
          height -
          borderWidth.top -
          borderWidth.bottom -
          schema.padding.top -
          schema.padding.bottom,
        fontName: schema.fontName,
        alignment: schema.alignment,
        verticalAlignment: schema.verticalAlignment,
        fontSize: schema.fontSize,
        lineHeight: schema.lineHeight,
        characterSpacing: schema.characterSpacing,
        fontColor: schema.fontColor,
        backgroundColor: '',
        dynamicFontSize: schema.dynamicFontSize,
      };

      const fontSize = calculateDynamicFontSize({
        textSchema,
        fontKitFont,
        value: schema.content || '',
      });

      uiSchema = { ...uiSchema, fontSize };
    }

    await textUiRender({
      ...arg,
      schema: uiSchema,
      rootElement: textDiv,
    });
    rootElement.appendChild(textDiv);

    const lines = [
      createLineDiv(`${width}mm`, `${borderWidth.top}mm`, '0mm', null, null, '0mm', borderColor),
      createLineDiv(`${width}mm`, `${borderWidth.bottom}mm`, null, null, '0mm', '0mm', borderColor),
      createLineDiv(`${borderWidth.left}mm`, `${height}mm`, '0mm', null, null, '0mm', borderColor),
      createLineDiv(`${borderWidth.right}mm`, `${height}mm`, '0mm', '0mm', null, null, borderColor),
    ];

    lines.forEach((line) => rootElement.appendChild(line));
  },
  propPanel: {
    schema: ({ options, i18n }) => {
      const font = options.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
      const fontNames = Object.keys(font);
      const fallbackFontName = getFallbackFontName(font);
      return getCellPropPanelSchema({ i18n, fontNames, fallbackFontName });
    },
    defaultSchema: {
      name: '',
      type: 'cell',
      content: 'Type Something...',
      position: { x: 0, y: 0 },
      width: 50,
      height: 15,
      ...getDefaultCellStyles(),
    },
  },
};
export default cellSchema;
