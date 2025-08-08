import moment from 'moment-timezone';
import Order from '../../models/orderModel.js';
import Coupon from '../../models/couponModel.js';
import PDFDocument from 'pdfkit';
import excel from 'exceljs';

const TIMEZONE = 'Asia/Kolkata';

// Helper function to get date range
const getDateRange = (type, customStartDate, customEndDate) => {
    const now = moment().tz(TIMEZONE);
    switch (type) {
        case 'daily':
            return {
                start: now.clone().startOf('day'),
                end: now.clone().endOf('day')
            };
        case 'weekly':
            return {
                start: now.clone().startOf('week'),
                end: now.clone().endOf('week')
            };
        case 'monthly':
            return {
                start: now.clone().startOf('month'),
                end: now.clone().endOf('month')
            };
        case 'yearly':
            return {
                start: now.clone().startOf('year'),
                end: now.clone().endOf('year')
            };
        case 'custom':
            return {
                start: moment.tz(customStartDate, TIMEZONE).startOf('day'),
                end: moment.tz(customEndDate, TIMEZONE).endOf('day')
            };
        default:
            return {
                start: now.clone().startOf('day'),
                end: now.clone().endOf('day')
            };
    }
};

// Render the sales report EJS page
export const getSalesReportPage = (req, res) => {
  res.render('admin/sales-report', { 
    title: 'Sales Report',
    path: '/admin/sales-report'
  });
};

// Fetch sales report data (AJAX)
export const getSalesReport = async (req, res) => {
  try {
    const orders = await Order.find({
      createdAt: {
        $gte: moment().startOf('month').toDate(),
        $lte: moment().endOf('month').toDate(),
      }
    }).populate('user', 'name email')
      .populate('items.product', 'name');

    let tableData = [];
    let totalSales = 0;
    let totalOrders = 0;
    let totalDiscount = 0;

    for (const order of orders) {
      let orderHasSale = false;

     for (const item of order.items) {
  if (item.status === 'Delivered' || item.status === 'Completed') {
    orderHasSale = true;

    const itemTotal = item.paidPrice * item.quantity;
    totalSales += itemTotal;

    tableData.push({
      id: order.orderID,
      date: moment(order.createdAt).tz("Asia/Kolkata").format("DD/MM/YYYY, h:mm A"),
      customer: order.user?.name || order.user?.email || 'N/A',
      product: item.product?.name || 'Unknown Product',
      quantity: item.quantity,
      price: item.paidPrice,
      total: itemTotal,
      status: item.status,
      paymentMethod: order.paymentMethod
    });
  }
}


      if (orderHasSale) {
        totalOrders++;
        totalDiscount += order.discountAmount || 0;
      }
    }

    res.json({
      summary: {
        totalSales,
        totalOrders,
        totalDiscount
      },
      tableData,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        totalOrders,
        limit: tableData.length
      }
    });

  } catch (err) {
    console.error('Sales report error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


// Download PDF sales report
export const downloadPdfReport = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);

    const orders = await Order.find({
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
      status: { $in: ['Delivered', 'Completed'] },
    })
    .populate('user', 'email name')
    .populate('items.product', 'name');

    const doc = new PDFDocument({ 
      margin: 20,
      size: 'A4',
      layout: 'portrait'
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${range}-${moment().tz(TIMEZONE).format('YYYY-MM-DD')}.pdf`);
    doc.pipe(res);

    // Title and Header
    const generatedAt = moment().tz(TIMEZONE).format('DD/MM/YYYY, h:mm:ss a');
    doc.fontSize(22).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${generatedAt}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Period: ${start.format('DD/MM/YYYY')} to ${end.format('DD/MM/YYYY')}`, { align: 'center' });
    doc.moveDown(1.5);

    // Summary Section
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);

    // Create summary box
    const summaryY = doc.y;
    doc.rect(40, summaryY, 515, 35).stroke();
    doc.fontSize(12).font('Helvetica-Bold').text('Summary', 50, summaryY + 8);
    doc.fontSize(10).font('Helvetica').text(`Total Sales: ₹${totalSales.toLocaleString('en-IN')}`, 50, summaryY + 20);
    doc.text(`Total Orders: ${totalOrders}`, 220, summaryY + 20);
    doc.text(`Total Discount: ₹${totalDiscount.toLocaleString('en-IN')}`, 380, summaryY + 20);
    doc.moveDown(2);

    // Table Headers
    const tableStartY = doc.y;
    const colWidths = [85, 85, 115, 60, 60, 45, 60]; // Order ID, Date, Customer, Total, Status, Coupon, Disc
    const headers = ['Order ID', 'Date', 'Customer', 'Total', 'Status', 'Coupon', 'Disc'];
    
    // Draw table header
    let currentX = 40;
    headers.forEach((header, index) => {
      doc.rect(currentX, tableStartY, colWidths[index], 22).stroke();
      doc.fontSize(9).font('Helvetica-Bold').text(header, currentX + 3, tableStartY + 6);
      currentX += colWidths[index];
    });

    // Table Data
    let currentY = tableStartY + 22;
    orders.forEach((order, index) => {
      // Check if we need a new page
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        currentY = 40;
      }

      // Calculate discount offer
      const couponDiscount = order.coupon ? (order.discountAmount || 0) : 0;
      const offerDiscount = order.discountAmount ? (order.discountAmount - couponDiscount) : 0;
      const discountOffer = `₹${offerDiscount} ₹${couponDiscount}`;

      // Draw row
      currentX = 40;
      const rowData = [
        order.orderID || order._id.toString().substring(0, 8),
        moment(order.createdAt).tz(TIMEZONE).format('DD/MM/YYYY, h:mm a'),
        order.user?.name || order.user?.email || 'N/A',
        `₹${order.totalAmount.toLocaleString('en-IN')}`,
        order.status,
        order.coupon?.code || '-',
        discountOffer
      ];

      rowData.forEach((cellData, cellIndex) => {
        doc.rect(currentX, currentY, colWidths[cellIndex], 20).stroke();
        // Make Total column bold like in the image
        if (cellIndex === 3) { // Total column
          doc.fontSize(8).font('Helvetica-Bold').text(cellData, currentX + 3, currentY + 5);
        } else {
          doc.fontSize(8).font('Helvetica').text(cellData, currentX + 3, currentY + 5);
        }
        currentX += colWidths[cellIndex];
      });

      currentY += 20;
    });

    // Add total at bottom safely
    if (doc.y + 40 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Sales: ₹${totalSales.toLocaleString('en-IN')}`, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF report');
  }
};

// Download Excel sales report
export const downloadExcelReport = async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);

    const orders = await Order.find({
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
      status: { $in: ['Delivered', 'Completed'] },
    })
    .populate('user', 'name email')
    .populate('items.product', 'name');

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add title and date range
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add generated on time
    const generatedAt = moment().tz(TIMEZONE).format('DD/MM/YYYY, h:mm:ss a');
    worksheet.mergeCells('A2:G2');
    worksheet.getCell('A2').value = `Generated on: ${generatedAt}`;
    worksheet.getCell('A2').alignment = { horizontal: 'right' };

    // Add period
    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A3').value = `Period: ${start.format('DD/MM/YYYY')} to ${end.format('DD/MM/YYYY')}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    // Add summary
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);

    worksheet.mergeCells('A5:G5');
    worksheet.getCell('A5').value = 'Summary';
    worksheet.getCell('A5').font = { bold: true };
    worksheet.getCell('A6').value = `Total Sales: ₹${totalSales.toLocaleString('en-IN')}`;
    worksheet.getCell('A7').value = `Total Orders: ${totalOrders}`;
    worksheet.getCell('A8').value = `Total Discount: ₹${totalDiscount.toLocaleString('en-IN')}`;

    // Add table headers
    let startRow = 10;
    const headers = ['Order ID', 'Date', 'Customer', 'Total', 'Status', 'Coupon', 'Disc'];
    worksheet.addRow(headers);
    startRow++;

    // Add table data
    orders.forEach(order => {
        // Calculate discount offer
        const couponDiscount = order.coupon ? (order.discountAmount || 0) : 0;
        const offerDiscount = order.discountAmount ? (order.discountAmount - couponDiscount) : 0;
        const discountOffer = `₹${offerDiscount} ₹${couponDiscount}`;

        worksheet.addRow([
            order.orderID || order._id.toString().substring(0, 8),
            moment(order.createdAt).tz(TIMEZONE).format('DD/MM/YYYY, h:mm a'),
            order.user?.name || order.user?.email || 'N/A',
            `₹${order.totalAmount.toLocaleString('en-IN')}`,
            order.status,
            order.coupon?.code || '-',
            discountOffer
        ]);
        startRow++;
    });

    // Add total at bottom
    worksheet.mergeCells(`A${startRow + 1}:G${startRow + 1}`);
    worksheet.getCell(`A${startRow + 1}`).value = `Total Sales: ₹${totalSales.toLocaleString('en-IN')}`;
    worksheet.getCell(`A${startRow + 1}`).font = { bold: true };
    worksheet.getCell(`A${startRow + 1}`).alignment = { horizontal: 'right' };

    // Adjust column widths based on content (optional, might need refinement)
     worksheet.columns.forEach(column => {
         let maxLength = 0;
         column.eachCell({ includeEmpty: true }, (cell) => {
             const columnText = cell.value ? cell.value.toString() : '';
             if (columnText.length > maxLength) {
                 maxLength = columnText.length;
             }
         });
         // Add some padding to the max length
         column.width = maxLength < 10 ? 10 : maxLength + 2;
     });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${range}-${moment().tz(TIMEZONE).format('YYYY-MM-DD')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).send('Error generating Excel report');
  }
}; 