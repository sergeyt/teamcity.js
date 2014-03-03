// simple require for tests running in browser by karma-runner
window.require = function(name){

	var mods = [
		[/teamcity/, window.teamcity],
		[/should/, window.should],
		[/underscore/, window._],
	];

	var mod = _.find(mods, function(m){
		return m[0].test(name);
	});

	return mod ? mod[1] : null;
};
