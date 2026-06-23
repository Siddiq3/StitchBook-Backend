/**
 * Swagger Configuration
 * Loads OpenAPI 3.0 Documentation from YAML file
 */

const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load OpenAPI spec from YAML file
const openApiPath = path.join(__dirname, '../../docs/openapi.yaml');
const openApiSpec = yaml.load(fs.readFileSync(openApiPath, 'utf8'));

module.exports = {
  swaggerUi,
  specs: openApiSpec
};