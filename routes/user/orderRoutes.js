// Add this route handler for failed orders
router.get('/failed/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { error } = req.query;

        res.render('user/order-failed', {
            orderId,
            error: error || 'An error occurred while processing your order'
        });
    } catch (error) {
        console.error('Error rendering failed order page:', error);
        res.status(500).render('error', {
            message: 'Failed to load the error page'
        });
    }
}); 