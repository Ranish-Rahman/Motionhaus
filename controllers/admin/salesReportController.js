import Order from '../../models/orderModel.js';
import PDFDocument from 'pdfkit';
import excel from 'exceljs';
import moment from 'moment-timezone';

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

// Get sales report data
export const getSalesReport = async (req, res) => {
    try {
        const { type, startDate, endDate } = req.query;
        const dateRange = getDateRange(type, startDate, endDate);

        const orders = await Order.find({
            createdAt: {
                $gte: dateRange.start.toDate(),
                $lte: dateRange.end.toDate()
            }
        }).populate('user', 'name');

        const summary = {
            totalOrders: orders.length,
            totalSales: orders.reduce((sum, order) => sum + order.total, 0),
            totalDiscounts: orders.reduce((sum, order) => sum + (order.discount || 0), 0)
        };

        const formattedOrders = orders.map(order => ({
            orderId: order._id,
            date: moment(order.createdAt).format('DD/MM/YYYY'),
            user: order.user ? order.user.name : 'N/A',
            total: order.total,
            discount: order.discount || 0,
            netAmount: order.total - (order.discount || 0),
            paymentMethod: order.paymentMethod,
            status: order.status
        }));

        res.json({
            summary,
            orders: formattedOrders,
            dateRange: {
                start: dateRange.start.format('DD/MM/YYYY'),
                end: dateRange.end.format('DD/MM/YYYY')
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Download sales report
export const downloadSalesReport = async (req, res) => {
    try {
        const { type, startDate, endDate } = req.query;
        const { format } = req.params;
        const dateRange = getDateRange(type, startDate, endDate);

        const orders = await Order.find({
            createdAt: {
                $gte: dateRange.start.toDate(),
                $lte: dateRange.end.toDate()
            }
        }).populate('user', 'name');

        if (format === 'pdf') {
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);
            doc.pipe(res);

            // Add PDF content
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Date Range: ${dateRange.start.format('DD/MM/YYYY')} to ${dateRange.end.format('DD/MM/YYYY')}`);
            doc.moveDown();

            // Add summary
            doc.text(`Total Orders: ${orders.length}`);
            doc.text(`Total Sales: ₹${orders.reduce((sum, order) => sum + order.total, 0)}`);
            doc.text(`Total Discounts: ₹${orders.reduce((sum, order) => sum + (order.discount || 0), 0)}`);
            doc.moveDown();

            // Add table headers
            const tableTop = 200;
            doc.text('Order ID', 50, tableTop);
            doc.text('Date', 150, tableTop);
            doc.text('Total', 250, tableTop);
            doc.text('Discount', 350, tableTop);
            doc.text('Net Amount', 450, tableTop);

            // Add table rows
            let yPosition = tableTop + 20;
            orders.forEach(order => {
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }
                doc.text(order._id.toString(), 50, yPosition);
                doc.text(moment(order.createdAt).format('DD/MM/YYYY'), 150, yPosition);
                doc.text(`₹${order.total}`, 250, yPosition);
                doc.text(`₹${order.discount || 0}`, 350, yPosition);
                doc.text(`₹${order.total - (order.discount || 0)}`, 450, yPosition);
                yPosition += 20;
            });

            doc.end();
        } else if (format === 'excel') {
            const workbook = new excel.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 30 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'User', key: 'user', width: 20 },
                { header: 'Total', key: 'total', width: 15 },
                { header: 'Discount', key: 'discount', width: 15 },
                { header: 'Net Amount', key: 'netAmount', width: 15 },
                { header: 'Payment Method', key: 'paymentMethod', width: 20 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            orders.forEach(order => {
                worksheet.addRow({
                    orderId: order._id.toString(),
                    date: moment(order.createdAt).format('DD/MM/YYYY'),
                    user: order.user ? order.user.name : 'N/A',
                    total: order.total,
                    discount: order.discount || 0,
                    netAmount: order.total - (order.discount || 0),
                    paymentMethod: order.paymentMethod,
                    status: order.status
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else {
            res.status(400).json({ error: 'Invalid format specified' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}; 