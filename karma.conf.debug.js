// Karma configuration for debug

module.exports = function(config) {

	// apply base config
	require('./karma.conf.js')(config);

	config.set({
		browsers: ['Chrome'],

		// enable / disable watching file and executing tests whenever any file changes
		autoWatch: true,

		// disable coverage
		preprocessors: {
			'test/*.coffee': 'coffee'
		},

		coffeePreprocessor: {
			// options passed to the coffee compiler
			options: {
				bare: true,
				sourceMap: true
			}
		},

		reporters: ['dots']
	});
};
