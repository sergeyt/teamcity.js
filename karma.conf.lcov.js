// karma config to get .lcov for coveralls
module.exports = function(config) {
	// apply base config
	require('./karma.conf.js')(config);

	config.set({
		coverageReporter: {
			type: 'lcov',
			dir: '.coverage'
		}
	});
};