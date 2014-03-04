// http://confluence.jetbrains.com/display/TCD8/REST+API
(function(){

	// detect environment
	var require_impl;
	var env = 'browser';
	if (typeof module !== 'undefined') {
		env = 'node';
		require_impl = require;
	} else if (typeof Meteor !== 'undefined' && Meteor.isServer) {
		env = 'meteor';
		require_impl = Npm.require;
	}

	var request, extend, defer;

	function node_request(request){
		return function(url, options){
			// accept fake request for tests
			var req = options.request || request;
			var d = defer();
			req(url, options, function(err, res, body){
				if (err) {
					d.reject(err);
				} else {
					console.log(body);
					if (typeof body == 'string') {
						body = JSON.parse(body);
					}
					d.resolve(body);
				}
			});
			return typeof d.promise == 'function' ? d.promise() : d.promise;
		};
	}

	switch (env){
		case 'node':
		case 'meteor':
			defer = require_impl('q').defer;
			extend = require_impl('underscore').extend;
			request = node_request(require_impl('request'), require_impl('q'));
		break;
		default:
			defer = $.Deferred;
			extend = $.extend;
			request = function(url, options){
				// accept fake request for tests
				if (options.request){
					return node_request(options.request)(url, options);
				}
				var auth = options.auth;
				// TODO pass 'accept: application/json' header
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

	function is_absolute_uri(uri){
		return (/^https?:\/\//i).test(uri);
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

		// auto-fix endpoint
		var app_rest = 'httpAuth/app/rest';
		if (endpoint.indexOf(app_rest) >= 0) {
			endpoint = endpoint.replace(app_rest, '');
		}
		if (endpoint.charAt(endpoint.length - 1) != '/'){
			endpoint += '/';
		}

		var user = options.user || options.username;
		var password = options.password || options.pwd;
		if (!user || typeof user != 'string') {
			throw new Error("Required 'user' option is not specified.");
		}
		if (!password || typeof password != 'string') {
			throw new Error("Required 'password' option is not specified.");
		}

		var req_opts = {
			auth: {
				user: user,
				pass: password
			},
			headers: {
				accept: 'application/json'
			}
		};

		function build_url(baseUrl, entity, locator){
			if (!baseUrl) {
				baseUrl = endpoint + app_rest;
			} else if (!is_absolute_uri(baseUrl)) {
				baseUrl = endpoint + baseUrl;
			}
			if (baseUrl.charAt(baseUrl.length - 1) != '/'){
				baseUrl += '/';
			}
			var url = baseUrl + entity;
			if (locator){
				url += Object.keys(locator).map(function(key){
					var val = locator[key];
					return key + ':' + val;
				}).join(',');
			}
			return url;
		}

		function get(baseUrl, entity, locator){
			var url = build_url(baseUrl, entity, locator);
			console.log(url);
			return request(url, req_opts);
		}

		// api
		function projectsFn(baseUrl){
			return function(locator){
				return get(baseUrl, 'projects', locator).then(function(d){
					var list = d.project || [];
					return list.map(function(prj){
						var href = prj.href;
						return extend(prj, {
							// configs: configsFn(href),
							projects: projectsFn(href),
							parameters: function(){
								return get(href, 'parameters');
							},
							templates: function(){
								return get(href, 'templates');
							},
							description: function(){
								return get(href, 'description');
							},
							archived: function(){
								return get(href, 'archived');
							}
						});
					});
				});
			};
		}

		function configsFn(baseUrl){
			return function(locator){
				// TODO convert into objects with additional API
				return get(baseUrl, 'buildTypes', locator).then(function(d){
					var list = d.buildType || [];
					return list.map(function(cfg){
						var href = cfg.href;
						return extend(cfg, {
							paused: function(){
								return get(href, 'paused');
							},
							settings: function(){
								return get(href, 'settings');
							},
							parameters: function(){
								return get(href, 'parameters');
							},
							steps: function(){
								return get(href, 'steps');
							},
							features: function(){
								return get(href, 'features');
							},
							triggers: function(){
								return get(href, 'triggers');
							},
							agent_requirements: function(){
								return get(href, 'agent-requirements');
							},
							artifact_dependencies: function(){
								return get(href, 'artifact-dependencies');
							},
							snapshot_dependencies: function(){
								return get(href, 'snapshot-dependencies');
							},
							vcs_roots: function(){
								return get(href, 'vcs-root-entries');
							},
							artifacts: {
								content: function(name){
									return get(href, 'artifacts/content/' + name);
								},
								metadata: function(name){
									return get(href, 'artifacts/metadata/' + name);
								},
								children: function(name){
									// TODO support nested requests
									return get(href, 'artifacts/children/' + name);
								}
							}
						});
					});
				});
			};
		}

		var vcs_roots = function(locator){
			// TODO convert into objects with additional API
			return get('', 'vcs-roots', locator);
		};

		function builds(locator){
			return get('', 'builds', locator).then(function(d){
				var list = d.build || [];
				return list.map(function(build){
					var href = build.href;
					return extend(build, {
						tags: function(){
							return get(href, 'tags');
						},
						pin: function(){
							// TODO primitive values should be retrieved as text/plain
							return get(href, 'pin');
						},
						status_icon: build_url(href, 'statusIcon')
					});
				});
			});
		}

		return {
			projects: projectsFn(''),
			configs: configsFn(''),
			vcs_roots: vcs_roots,
			builds: builds,
			changes: function(locator){
				return get('', 'changes', locator);
			},
			build_queue: function(locator){
				return get('', 'buildQueue', locator);
			},
			features: function(){
				return get('', 'application.wadl');
			}
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
