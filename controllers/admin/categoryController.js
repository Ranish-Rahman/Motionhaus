import Category from '../../models/categoryModel.js';
import mongoose from 'mongoose';

// Get all categories
export const getCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Remove isDeleted filter to show all categories
        const query = {};
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const [categories, total] = await Promise.all([
            Category.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Category.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/category', {
            title: 'Category Management',
            categories,
            currentPage: page,
            totalPages,
            search,
            success: req.flash('success'),
            error: req.flash('error'),
            path: '/admin/categories'
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        req.flash('error', 'Error fetching categories. Please try again.');
        res.redirect('/admin/categories');
    }
};

// Get add category page
export const getAddCategory = (req, res) => {
    res.render('admin/add-category', {
        title: 'Add Category',
        success: req.flash('success'),
        error: req.flash('error'),
        path: '/admin/categories/add'
    });
};

// Add new category
export const addCategory = async (req, res) => {
    try {
        let { name, description } = req.body;
        console.log('Received category data:', { name, description });

        // Validate input
        if (!name || !name.trim()) {
            console.log('Validation failed: Name is required');
            if (req.headers['content-type'] === 'application/json') {
                return res.status(400).json({ error: 'Category name is required' });
            }
            req.flash('error', 'Category name is required');
            return res.redirect('/admin/categories/add');
        }

        // Check if category already exists
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            isDeleted: false 
        });

        if (existingCategory) {
            console.log('Validation failed: Category already exists');
            if (req.headers['content-type'] === 'application/json') {
                return res.status(400).json({ error: 'Category already exists' });
            }
            req.flash('error', 'Category already exists');
            return res.redirect('/admin/categories/add');
        }

        // Create new category
        const category = new Category({
            name: name.trim(),
            description: description ? description.trim() : ''
        });

        await category.save();
        console.log('Category saved successfully:', category);

        if (req.headers['content-type'] === 'application/json') {
            return res.status(200).json({ success: true, message: 'Category added successfully' });
        }

        req.flash('success', 'Category added successfully');
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error adding category:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            const messages = Object.values(error.errors).map(err => err.message);
            if (req.headers['content-type'] === 'application/json') {
                return res.status(400).json({ error: messages.join(', ') });
            }
            req.flash('error', messages.join(', '));
        } else if (error.code === 11000) {
            if (req.headers['content-type'] === 'application/json') {
                return res.status(400).json({ error: 'Category name already exists' });
            }
            req.flash('error', 'Category name already exists');
        } else {
            if (req.headers['content-type'] === 'application/json') {
                return res.status(500).json({ error: 'Error adding category. Please try again.' });
            }
            req.flash('error', 'Error adding category. Please try again.');
        }
        res.redirect('/admin/categories/add');
    }
};

// Get edit category page
export const getEditCategory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            req.flash('error', 'Invalid category ID');
            return res.redirect('/admin/categories');
        }

        const category = await Category.findById(req.params.id);
        if (!category || category.isDeleted) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/categories');
        }

        res.render('admin/edit-category', {
            title: 'Edit Category',
            category,
            success: req.flash('success'),
            error: req.flash('error'),
            path: '/admin/categories/edit'
        });
    } catch (error) {
        console.error('Error fetching category:', error);
        req.flash('error', 'Error fetching category');
        res.redirect('/admin/categories');
    }
};

// Update category
export const editCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const categoryId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            req.flash('error', 'Invalid category ID');
            return res.redirect('/admin/categories');
        }

        // Validate input
        if (!name || !name.trim()) {
            req.flash('error', 'Category name is required');
            return res.redirect(`/admin/categories/edit/${categoryId}`);
        }

        // Check if category exists
        const existingCategory = await Category.findById(categoryId);
        if (!existingCategory || existingCategory.isDeleted) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/categories');
        }

        // Check if category name already exists (excluding current category)
        const duplicateCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            _id: { $ne: categoryId },
            isDeleted: false
        });

        if (duplicateCategory) {
            req.flash('error', 'Category name already exists');
            return res.redirect(`/admin/categories/edit/${categoryId}`);
        }

        // Update category
        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { 
                name: name.trim(),
                description: description ? description.trim() : ''
            },
            { 
                new: true,
                runValidators: true 
            }
        );

        if (!updatedCategory) {
            req.flash('error', 'Failed to update category');
            return res.redirect(`/admin/categories/edit/${categoryId}`);
        }

        req.flash('success', 'Category updated successfully');
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error updating category:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error', messages.join(', '));
        } else if (error.code === 11000) {
            req.flash('error', 'Category name already exists');
        } else {
            req.flash('error', 'Error updating category. Please try again.');
        }
        res.redirect(`/admin/categories/edit/${req.params.id}`);
    }
};

// Soft delete category
export const softDeleteCategory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            req.flash('error', 'Invalid category ID');
            return res.redirect('/admin/categories');
        }

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );

        if (!category) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/categories');
        }

        req.flash('success', 'Category deleted successfully');
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error deleting category:', error);
        req.flash('error', 'Error deleting category');
        res.redirect('/admin/categories');
    }
};

// Restore deleted category
export const restoreCategory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            req.flash('error', 'Invalid category ID');
            return res.redirect('/admin/categories');
        }

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { isDeleted: false },
            { new: true }
        );

        if (!category) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/categories');
        }

        req.flash('success', 'Category restored successfully');
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error restoring category:', error);
        req.flash('error', 'Error restoring category');
        res.redirect('/admin/categories');
    }
};
