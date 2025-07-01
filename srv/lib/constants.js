/**
 * constants.js
 * Define application-wide constants here
 */
const DEFAULTS = {
    query_limit: process.env.QUERY_LIMIT || 10,
    supportedAggregationFunctions : ['sum','max','min','avg','count','distinct'],
    supportedMiscelaneousFunctions : ['over'],
    ALLOWED_PARAMETER_NAMES : ['key', 'aggregation'],
    ALLOWED_PARAMETER_TYPES : ['formula_dimension']
};

module.exports = {
    DEFAULTS,
};