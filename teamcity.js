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
	var debug = function(x){};

	function node_request(request){
		return function(url, options){
			// accept fake request for tests
			var req = options.request || request;
			var d = defer();
			req(url, options, function(err, res, body){
				if (err) {
					debug('GET ' + url + ' failed with: ' + err);
					d.reject(err);
				} else {
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
			debug = require_impl('debug')('teamcity.js');
			defer = require_impl('q').defer;
			extend = require_impl('underscore').extend;
			request = node_request(require_impl('request'), require_impl('q'));
		break;
		default:
			if (typeof window.debug != 'undefined') {
				debug = window.debug('teamcity.js');
			}
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

	// utils
	function is_absolute_uri(uri){
		return (/^https?:\/\//i).test(uri);
	}

	function format(s, args){
		return s.replace(/\{(\d+)\}/g, function(m, i){
			var index = (+i);
			return typeof args[index] != 'undefined' ? args[index] : '';
		});
	}

	// locator submodule
	var Locator = function(){
		function stringify(locator){
			if (!locator) {
				return '';
			}
			if (typeof locator == 'string') {
				return locator;
			}
			if (typeof locator == 'object') {
				return Object.keys(locator).map(function(key){
					// support nesting
					var val = stringify(locator[key]);
					return val ? key + ':' + val : '';
				}).filter(function(s){ return s.length > 0; })
				.join(',');
			}
			return '';
		}
		return {
			stringify: stringify
		};
	}();

	// entity schemas
	var project_schema = {
		parameters: 'parameters',
		templates: 'templates',
		description: 'description', // TODO plain value
		archived: 'archived' // TODO plain value
		// TODO agent pools
	};

	var config_schema = {
		paused: 'paused', // TODO how to specify plain value
		settings: 'settings',
		parameters: 'parameters',
		steps: 'steps',
		features: 'features',
		triggers: 'triggers',
		agent_requirements: 'agent-requirements',
		artifact_dependencies: 'artifact-dependencies',
		snapshot_dependencies: 'snapshot-dependencies',
		vcs_roots: 'vcs-root-entries',
		artifacts: {
			content: 'artifacts/content/{0}',
			metadata: 'artifacts/metadata/{0}',
			children: 'artifacts/children/{0}'
		}
	};

	var build_schema = {
		tags: 'tags',
		pin: 'pin',
		status_icon: function(ctx){
			return ctx.build_url(ctx.href, 'statusIcon');
		},
		// TODO add other build's bean attributes if needed
		branch: 'branchName',
		statistics: 'statistics',
		// TODO implement url template approach, something like 'buildTypes/id:{buildTypeId}'
		config: function(ctx){
			return function(){
				var url = format('buildTypes/id:{0}', [ctx.entity.buildTypeId]);
				return ctx.get('', url);
			};
		}
	};

	// TODO create declarative schema for whole teamcity API

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
			return baseUrl + entity + Locator.stringify(locator);
		}

		function get(baseUrl, entity, locator){
			var url = build_url(baseUrl, entity, locator);
			debug('GET ' + url);
			return request(url, req_opts);
		}

		function entityFn(href, entity){
			return function(){
				var args = [].slice.call(arguments);
				var path = format(entity, args);
				return get(href, path);
			};
		}

		function map_schema(entity, schema){
			// context for functional properties
			var href = entity.href;
			var ctx = {
				entity: entity,
				get: get,
				build_url: build_url,
				href: href
			};
			var result = {};
			Object.keys(schema).forEach(function(key){
				// TODO support plain values
				var val = schema[key];
				if (typeof val == 'string') {
					result[key] = entityFn(href, val);
				} else if (typeof val == 'function') {
					result[key] = val(ctx);
				} else if (typeof val == 'object') {
					// nested schema
					result[key] = map_schema(href, val);
				}
			});
			return result;
		}

		// api
		function extend_project(prj){
			var href = prj.href;
			var extra = {
				// configs: configsFn(href),
				projects: projectsFn(href)
			};

			var api = map_schema(prj, project_schema);
			return extend(prj, extra, api);
		}

		function projectsFn(baseUrl){
			return function(locator){
				return get(baseUrl, 'projects', locator).then(function(d){
					var list = d.project || [];
					return list.map(extend_project);
				});
			};
		}

		function extend_config(cfg){
			var api = map_schema(cfg, config_schema);
			return extend(cfg, api);
		}

		function configsFn(baseUrl){
			return function(locator){
				return get(baseUrl, 'buildTypes', locator).then(function(d){
					var list = d.buildType || [];
					return list.map(extend_config);
				});
			};
		}

		function extend_build(build){
			var extra = map_schema(build, build_schema);
			return extend(build, extra);
		}

		return {
			// TODO try to create schema
			projects: projectsFn(''),
			configs: configsFn(''),
			vcs_roots: function(locator){
				// TODO convert into objects with additional API
				return get('', 'vcs-roots', locator);
			},
			builds: function(locator){
				return get('', 'builds', locator).then(function(d){
					var list = d.build || [];
					return list.map(extend_build);
				});
			},
			changes: function(locator){
				return get('', 'changes', locator);
			},
			build_queue: function(locator){
				return get('', 'buildQueue', locator);
			},
			tests: function(locator){
				return get('', 'testOccurrences?locator=', locator);
			},
			investigations: function(locator){
				return get('', 'investigations?locator=', locator);
			},
			agents: function(locator){
				return get('', 'agents', locator);
			},
			users: function(locator){
				return get('', 'users', locator);
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
