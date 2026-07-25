const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

const defaultPermissions = () => ({
  dashboard: { view: false, edit: false },
  orders: { view: false, edit: false },
  fulfillment: { view: false, edit: false },
  products: { view: false, edit: false },
  customers: { view: false, edit: false },
  settings: { view: false, edit: false },
  reports: { view: false, edit: false }
});

// List all employee accounts
exports.listEmployees = async (req, res) => {

  try {

    const employees = await Admin.find({ role: "employee" }).select("-password");

    res.json(employees);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

};

// Create a new employee account
exports.createEmployee = async (req, res) => {

  try {

    const { name, email, password, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email, and password are required"
      });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });

    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const employee = await Admin.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "employee",
      permissions: { ...defaultPermissions(), ...permissions }
    });

    const { password: _omit, ...safeEmployee } = employee.toObject();

    res.status(201).json(safeEmployee);

  } catch (err) {

    res.status(400).json({ error: err.message });

  }

};

// Update an employee's name / permissions / password
exports.updateEmployee = async (req, res) => {

  try {

    const employee = await Admin.findOne({ _id: req.params.id, role: "employee" });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const { name, permissions, password } = req.body;

    if (name !== undefined) employee.name = name;

    if (permissions !== undefined) {
      Object.keys(permissions).forEach((section) => {
        if (!employee.permissions[section]) return;

        if (permissions[section].view !== undefined) {
          employee.permissions[section].view = permissions[section].view;
        }

        if (permissions[section].edit !== undefined) {
          employee.permissions[section].edit = permissions[section].edit;
        }
      });

      employee.markModified("permissions");
    }

    if (password) {
      employee.password = await bcrypt.hash(password, 12);
    }

    await employee.save();

    const { password: _omit, ...safeEmployee } = employee.toObject();

    res.json(safeEmployee);

  } catch (err) {

    res.status(400).json({ error: err.message });

  }

};

// Delete an employee account
exports.deleteEmployee = async (req, res) => {

  try {

    const employee = await Admin.findOneAndDelete({ _id: req.params.id, role: "employee" });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ success: true });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

};
