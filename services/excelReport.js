const ExcelJS = require("exceljs");
const QuickChart = require("quickchart-js");

const BRAND_COLOR = "FF00674E";

function addSheet(workbook, { name, columns, rows }) {

  const sheet = workbook.addWorksheet(name);

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 20
  }));

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_COLOR }
    };
  });

  rows.forEach((row) => sheet.addRow(row));

  return sheet;

}

function buildWorkbook(sheets) {

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Silkwaves Admin";
  workbook.created = new Date();

  sheets.forEach((sheetDef) => addSheet(workbook, sheetDef));

  return workbook;

}

async function addChartImage(workbook, sheet, chartConfig, anchor = { col: 0, row: 0 }, size = { width: 600, height: 300 }) {

  const chart = new QuickChart();

  chart.setConfig(chartConfig);
  chart.setWidth(size.width);
  chart.setHeight(size.height);
  chart.setBackgroundColor("white");

  const buffer = await chart.toBinary();

  const imageId = workbook.addImage({
    buffer,
    extension: "png"
  });

  sheet.addImage(imageId, {
    tl: anchor,
    ext: size,
    editAs: "oneCell"
  });

  return imageId;

}

async function sendWorkbook(res, workbook, filename) {

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  await workbook.xlsx.write(res);

  res.end();

}

module.exports = { buildWorkbook, addSheet, addChartImage, sendWorkbook };
