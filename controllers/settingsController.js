const Setting = require("../models/Setting");

exports.getSettings = async (req, res) => {

  try {

    let settings = await Setting.findOne();

    if (!settings) {

      settings = await Setting.create({});

    }

    res.json(settings);

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};

exports.saveSettings = async (req, res) => {

  try {

    let settings = await Setting.findOne();

    if (!settings) {

      settings = new Setting();

    }

    Object.assign(settings, req.body);

    await settings.save();

    res.json({

      success: true,

      settings

    });

  }

  catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};