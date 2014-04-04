module.exports = (grunt) ->

  # Project configuration.
	grunt.initConfig
		pkgFile: 'package.json'

		'npm-contributors':
			options:
				commitMessage: 'chore: update contributors'

		bump:
			options:
				commitMessage: 'chore: release v%VERSION%'
				pushTo: 'origin'

		'auto-release':
			options:
				checkTravisBuild: false

		jshint:
			options:
				# Expected an assignment or function call and instead saw an expression.
				'-W030': true,
				globals:
					node: true,
					console: true,
					module: true,
					require: true
			dev:
				options:
					ignores: ['*.min.js', 'lib/*.min.js', 'bin/*.min.js']
				src: ['lib/*.js', 'bin/*.js', '*.js']

		coffeelint:
			options:
				no_tabs: {level: 'ignore'}
				indentation: {level: 'ignore'}
			dev: ['*.coffee', 'bin/*.coffee', 'lib/*.coffee']

		simplemocha:
			options:
				ui: 'bdd'
				reporter: 'spec'
			all: src: ['test/*.coffee']

		karma:
			dev:
				configFile: 'karma.conf.js',
				singleRun: true
			lcov:
				configFile: 'karma.conf.lcov.js',
				singleRun: true

	grunt.loadNpmTasks 'grunt-contrib-jshint'
	grunt.loadNpmTasks 'grunt-coffeelint'
	grunt.loadNpmTasks 'grunt-npm'
	grunt.loadNpmTasks 'grunt-bump'
	grunt.loadNpmTasks 'grunt-auto-release'
	grunt.loadNpmTasks 'grunt-simple-mocha'
	grunt.loadNpmTasks 'grunt-karma'

	grunt.registerTask 'release', 'Bump the version and publish to NPM.',
		(type) -> grunt.task.run [
			'npm-contributors',
			"bump:#{type||'patch'}",
			'npm-publish'
		]

	grunt.registerTask 'lint', ['coffeelint', 'jshint']
	grunt.registerTask 'test', ['lint', 'simplemocha', 'karma:dev']
	grunt.registerTask 'default', ['test']
