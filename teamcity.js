// http://confluence.jetbrains.com/display/TCD8/REST+API
(function(){

	// detect environment
	var env = 'browser';
	if (typeof module !== 'undefined') {
		env = 'node';
	} else if (typeof Meteor !== 'undefined' && Meteor.isServer) {
		env = 'meteor';
	}

	var request;

	function node_request(request, Q){
		return function(url, options){
			// TODO accept fake request for tests
			var d = Q.defer();
			request(url, options, function(err, res, body){
				if (err) {
					d.reject(err);
				} else {
					d.resolve(body);
				}
			});
		};
	}

	switch (env){
		case 'node':
			request = node_request(require('request'), require('q'));
		break;
		case 'meteor':
			request = node_request(Npm.require('request'), Npm.require('q'));
		break;
		default:
			request = function(url, options){
				// TODO accept fake request for tests
				var auth = options.auth;
				return $.ajax({
					type: 'GET',
					url: url,
					dataType: 'json',
					username: auth.user,
					password: auth.pass
				});
			};
		break;
	}

	function teamcity(options){
		// check required options
		if (typeof options != 'object'){
			throw new Error('Options are not specified.');
		}

		var endpoint = options.url || options.endpoint;
		if (!endpoint || typeof endpoint != 'string'){
			throw new Error("Required 'endpoint' option is not specified.");
		}

		var user = options.user;
		var password = options.password || options.pwd;
		if (!user || typeof user != 'string') {
			throw new Error("Required 'user' option is not specified.");
		}
		if (!password || typeof password != 'string') {
			throw new Error("Required 'password' option is not specified.");
		}

		var auth = {
			user: user,
			pass: password
		};

		var get = function(url){
			return request(endpoint + url, {auth: auth});
		};

		var vcs_roots = function(locator){
			// TODO support locator
			// TODO convert into objects with additional API
			return get('vcs-roots');
		};

		// api
		return {
			projects: function(locator){
				// TODO support locator
				// TODO convert into objects with additional API
				return get('projects');
			},
			configs: function(locator){
				// TODO support locator
				// TODO convert into objects with additional API
				return get('buildTypes');
			},
			vcs_roots: vcs_roots,
			'vcs-roots': vcs_roots
		};
	}

	// expose public api for different environments
	switch (env) {
		case 'node':
			module.exports = teamcity;
			break;
		case 'meteor':
			TeamCity = teamcity;
			// aliases
			TeamCity.connect = teamcity;
			TeamCity.create = teamcity;
			break;
		default:
			window.teamcity = teamcity;
			break;
	}

})();
