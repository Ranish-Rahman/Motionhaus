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
    console.log('Sales Report Request:', {
      query: req.query,
      path: req.path,
      method: req.method
    });

    const { range, startDate, endDate, page = 1, limit = 10 } = req.query;
    let start, end;

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    if (range === 'daily') {
      start = moment().tz(TIMEZONE).startOf('day');
      end = moment().tz(TIMEZONE).endOf('day');
    } else if (range === 'weekly') {
      start = moment().tz(TIMEZONE).startOf('week');
      end = moment().tz(TIMEZONE).endOf('week');
    } else if (range === 'yearly') {
      start = moment().tz(TIMEZONE).startOf('year');
      end = moment().tz(TIMEZONE).endOf('year');
    } else if (range === 'custom' && startDate && endDate) {
      start = moment.tz(startDate, TIMEZONE).startOf('day');
      end = moment.tz(endDate, TIMEZONE).endOf('day');
    } else {
      console.log('Invalid range or dates:', { range, startDate, endDate });
      return res.status(400).json({ error: 'Invalid range or dates' });
    }

    console.log('Date Range:', {
      start: start.format(),
      end: end.format(),
      timezone: TIMEZONE
    });

    // Get total count for pagination
    const totalOrders = await Order.countDocuments({
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
      status: { $nin: ['Cancelled', 'Returned'] },
    });

    // Fetch orders in the date range with pagination
    const orders = await Order.find({
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
      status: { $nin: ['Cancelled', 'Returned'] },
    })
    .populate('user', 'name email')
    .populate('items.product', 'name')
    .populate('coupon', 'code')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

    console.log('Found Orders:', {
      count: orders.length,
      firstOrder: orders[0] ? {
        id: orders[0]._id,
        createdAt: orders[0].createdAt,
        totalAmount: orders[0].totalAmount,
        status: orders[0].status
      } : null
    });

    // Calculate summary
    let totalSales = 0;
    let totalDiscount = 0;

    for (const order of orders) {
      totalSales += order.totalAmount || 0;
      
      // Calculate total discount from both coupon and product-level discounts
      if (order.items) {
        // Sum up product-level discounts
        order.items.forEach(item => {
          if (item.originalPrice && item.price) {
            const itemDiscount = (item.originalPrice * item.quantity) - (item.price * item.quantity);
            totalDiscount += itemDiscount;
          }
        });
      }
      
      // Add coupon discount if present
      if (order.coupon) {
        const coupon = await Coupon.findById(order.coupon).lean();
        if (coupon && coupon.discountAmount) {
          totalDiscount += coupon.discountAmount;
        }
      }
    }

    console.log('Summary:', {
      totalSales,
      totalOrders,
      totalDiscount
    });

    // Prepare table data
    const tableData = orders.map(order => ({
      id: order._id,
      date: moment(order.createdAt).tz(TIMEZONE).format('YYYY-MM-DD HH:mm'),
      customer: order.user?.name || order.user?.email || 'N/A',
      total: order.totalAmount,
      status: order.status,
      coupon: order.coupon?.code || '-',
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalOrders / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      summary: {
        totalSales,
        totalOrders,
        totalDiscount
      },
      tableData,
      pagination: {
        currentPage: pageNum,
        totalPages,
        hasNextPage,
        hasPrevPage,
        totalOrders,
        limit: limitNum
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
      createdAt: { $gte: start.toDate(), $lte: end.toDate() }
    })
    .populate('user', 'email name')
    .populate('items.product', 'name');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${range}-${moment().tz(TIMEZONE).format('YYYY-MM-DD')}.pdf`);
    doc.pipe(res);

    // Title
    const generatedAt = moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss z'); // Include timezone in generated time
    doc.fontSize(24).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${generatedAt}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(`Period: ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);
    doc.moveDown(1);

    // Summary
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    // Assuming discountAmount is the correct field for order-level discount
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);

    doc.fontSize(13).font('Helvetica-Bold').text('Summary');
    doc.fontSize(11).font('Helvetica').text(`Total Orders: ${totalOrders}`);
    doc.text(`Total Sales:  ₹${totalSales.toFixed(2)}`);
    doc.text(`Total Discounts:  ₹${totalDiscount.toFixed(2)}`);
    doc.moveDown(1);

    // Orders by Status
    const statusList = ['delivered', 'processing', 'shipped', 'cancelled', 'returned'];
    const statusCounts = Object.fromEntries(statusList.map(s => [s, 0]));
    orders.forEach(order => {
      const status = (order.status || '').toLowerCase();
      if (statusCounts.hasOwnProperty(status)) statusCounts[status]++;
    });
    doc.fontSize(13).font('Helvetica-Bold').text('Orders by Status');
    doc.fontSize(11).font('Helvetica');
    statusList.forEach(s => {
      doc.text(`${s}: ${statusCounts[s]}`);
    });
    doc.moveDown(1);

    // Order Details
    doc.fontSize(13).font('Helvetica-Bold').text('Order Details');
    doc.moveDown(0.5);
    orders.forEach(order => {
        // Check if there's enough space for the next order details, add a new page if not
        if (doc.y + 150 > doc.page.height - doc.page.margins.bottom) { // Estimate space needed
            doc.addPage();
        }

      doc.fontSize(11).font('Helvetica-Bold').text(`Order ID: ${order._id}`);
      doc.fontSize(10).font('Helvetica').text(`(${moment(order.createdAt).tz(TIMEZONE).format('YYYY-MM-DD')})`);
      doc.fontSize(10).font('Helvetica').text(`Customer: ${order.user?.email || order.user?.name || 'N/A'}`);
      doc.text(`Total:  ₹${order.totalAmount.toFixed(2)} | Discount:  ₹${order.discountAmount?.toFixed(2) || '0.00'} | Net:  ₹${(order.totalAmount - (order.discountAmount || 0)).toFixed(2)}`);
      doc.text(`Payment Method: ${order.paymentMethod || 'N/A'} | Status: ${order.status}`);
      // Check if coupon exists before trying to access its properties
      doc.text(`Coupon: ${order.coupon?.code || 'N/A'}`); // Assuming coupon has a 'code' field

      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').text('Products:');
      order.items.forEach(item => {
        doc.font('Helvetica').text(`• ${item.product?.name || 'Product'} (${item.size || 'N/A'})`);
        doc.text(`  Quantity: ${item.quantity} | Price:  ₹${item.price?.toFixed(2) || '0.00'}`);
      });
      doc.moveDown(0.5);
      // Add a line separator between orders
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
      doc.moveDown(0.5);
    });

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
      createdAt: { $gte: start.toDate(), $lte: end.toDate() }
    })
    .populate('user', 'name email')
    .populate('items.product', 'name');

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add title and date range
    worksheet.mergeCells('A1:H1'); // Adjusted merge range for more columns
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:H2'); // Adjusted merge range
    worksheet.getCell('A2').value = `Period: ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

     // Add generated on time
    const generatedAt = moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss z');
    worksheet.mergeCells('A3:H3'); // Added row for generated on
    worksheet.getCell('A3').value = `Generated on: ${generatedAt}`;
    worksheet.getCell('A3').alignment = { horizontal: 'right' };


    // Add summary
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discountAmount || 0), 0);

    worksheet.mergeCells('A5:H5'); // Adjusted row for summary title
    worksheet.getCell('A5').value = 'Summary';
    worksheet.getCell('A5').font = { bold: true };
    worksheet.getCell('A6').value = `Total Orders: ${totalOrders}`;
    worksheet.getCell('A7').value = `Total Sales: ₹${totalSales.toFixed(2)}`;
    worksheet.getCell('A8').value = `Total Discounts: ₹${totalDiscount.toFixed(2)}`;

    // Add orders by status (similar to PDF)
    const statusList = ['delivered', 'processing', 'shipped', 'cancelled', 'returned'];
    const statusCounts = Object.fromEntries(statusList.map(s => [s, 0]));
    orders.forEach(order => {
      const status = (order.status || '').toLowerCase();
      if (statusCounts.hasOwnProperty(status)) statusCounts[status]++;
    });
    worksheet.mergeCells('A10:H10'); // Added row for status title
    worksheet.getCell('A10').value = 'Orders by Status';
    worksheet.getCell('A10').font = { bold: true };
    statusList.forEach((s, index) => {
      worksheet.getCell(11 + index, 1).value = `${s}: ${statusCounts[s]}`;
    });

    // Add orders table with more details
    let startRow = 11 + statusList.length + 2; // Start after status list and a gap
    worksheet.mergeCells(`A${startRow}:H${startRow}`);
    worksheet.getCell(`A${startRow}`).value = 'Order Details';
    worksheet.getCell(`A${startRow}`).font = { bold: true };
    startRow++;

    // Table headers for detailed orders
    const headers = ['Order ID', 'Date', 'Customer', 'Total', 'Discount', 'Net Amount', 'Payment Method', 'Status', 'Coupon', 'Products'];
    worksheet.addRow(headers);
    startRow++;

    // Table rows with detailed order and product info
    orders.forEach(order => {
        const netAmount = order.totalAmount - (order.discountAmount || 0);
        worksheet.addRow([
            order._id.toString(),
            moment(order.createdAt).tz(TIMEZONE).format('YYYY-MM-DD'),
            order.user?.name || order.user?.email || 'N/A',
            order.totalAmount,
            order.discountAmount || 0,
            netAmount.toFixed(2),
            order.paymentMethod || 'N/A',
            order.status || 'N/A',
            order.coupon?.code || 'N/A', // Assuming coupon has a 'code' field
            '' // Placeholder for products column
        ]);

        // Add product details under the order row
        order.items.forEach(item => {
            worksheet.addRow([
                '', '', '', '', '', '', '', '', // Empty cells for columns before products
                `• ${item.product?.name || 'Product'} (${item.size || 'N/A'})`,
                `Quantity: ${item.quantity} | Price: ₹${item.price?.toFixed(2) || '0.00'}`
            ]);
        });
        worksheet.addRow([]); // Add a blank row between orders for readability
    });

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