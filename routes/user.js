// Change Password Page
router.get('/change-password', isAuthenticated, (req, res) => {
  res.render('user/change-password', {
    user: req.user,
    success: req.flash('success'),
    error: req.flash('error')
  });
});

// Change Password Handler
router.post('/change-password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.redirect('/profile/change-password');
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/profile/change-password');
    }

    // Verify current password
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/profile/change-password');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    req.flash('success', 'Password updated successfully');
    res.redirect('/profile/change-password');
  } catch (error) {
    console.error('Error changing password:', error);
    req.flash('error', 'An error occurred while changing password');
    res.redirect('/profile/change-password');
  }
}); 