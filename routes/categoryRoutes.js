import express from 'express';
import { getCategories, getAddCategory, addCategory, getEditCategory, editCategory, softDeleteCategory } from '../controllers/admin/categoryController.js';
import { isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply admin middleware to all category routes
router.use(isAdmin);

// Category routes
router.get('/categories', getCategories);
router.get('/categories/add', getAddCategory);
router.post('/categories/add', addCategory);
router.get('/categories/edit/:id', getEditCategory);
router.post('/categories/edit/:id', editCategory);
router.post('/categories/delete/:id', softDeleteCategory);

export default router;
