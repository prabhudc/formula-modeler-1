/**
 * constants.js
 * Define application-wide constants here
 */
const DEFAULTS = {
    query_limit: process.env.QUERY_LIMIT || 10,
    supportedAggregationFunctions : ['sum','max','min','avg','count','distinct']
    
};

module.exports = {
    DEFAULTS,
};