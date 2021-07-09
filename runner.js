'use strict';

const {print} = require('@k03mad/utils');

require(`./app/tasks/${process.env.npm_config_name}`)()
    .then(msg => print.log(msg))
    .catch(err => print.ex(err, {full: true}));
