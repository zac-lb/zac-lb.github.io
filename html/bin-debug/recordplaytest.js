// We make use of this 'server' variable to provide the address of the
// REST Janus API. By default, in this example we assume that Janus is
// co-located with the web server hosting the HTML pages but listening
// on a different port (8088, the default for HTTP in Janus), which is
// why we make use of the 'window.location.hostname' base address. Since
// Janus can also do HTTPS, and considering we don't really want to make
// use of HTTP for Janus if your demos are served on HTTPS, we also rely
// on the 'window.location.protocol' prefix to build the variable, in
// particular to also change the port used to contact Janus (8088 for
// HTTP and 8089 for HTTPS, if enabled).
// In case you place Janus behind an Apache frontend (as we did on the
// online demos at http://janus.conf.meetecho.com) you can just use a
// relative path for the variable, e.g.:
//
// 		var server = "/janus";
//
// which will take care of this on its own.
//
//
// If you want to use the WebSockets frontend to Janus, instead, you'll
// have to pass a different kind of address, e.g.:
//
// 		var server = "ws://" + window.location.hostname + ":8188";
//
// Of course this assumes that support for WebSockets has been built in
// when compiling the gateway. WebSockets support has not been tested
// as much as the REST API, so handle with care!
//
//
// If you have multiple options available, and want to let the library
// autodetect the best way to contact your gateway (or pool of gateways),
// you can also pass an array of servers, e.g., to provide alternative
// means of access (e.g., try WebSockets first and, if that fails, fall
// back to plain HTTP) or just have failover servers:
//
//		var server = [
//			"ws://" + window.location.hostname + ":8188",
//			"/janus"
//		];
//
// This will tell the library to try connecting to each of the servers
// in the presented order. The first working server will be used for
// the whole session.
//
var server = null;
if(window.location.protocol === 'http:')
	server = "http://172.16.16.17:8088/janus";
else
	server = "http://172.16.16.17:8088/janus";

var janus = null;
var recordplay = null;
var started = false;
var spinner = null;
var bandwidth = 1024 * 1024;

var myname = "123";
var recording = false;
var playing = false;
var selectedRecording = null;
var selectedRecordingInfo = null;
var localStream = null;
var BlitzSDK = {};
function startsBlitz(uid,sid)
{
	BlitzSDK.init(
		{
			//本地视频绑定div
			localVideoId:"#lvideobox",
			//远端视频绑定div
			remoteVideoId:"#rvideobox",
			//setup成功,本地视频开始显示
			onSetup: function () {
				BlitzSDK.join(uid,"test",sid,server);
			},
			//登陆成功
			onLogined:function(){},
			//加入会话成功
			onJoined:function(){},
			//离开回调,同时登出离开会话
			onLeave:function(){},
			//会话内有用户进入
			onUserEnter:function(userId){
			},
			//会话内有用户退出
			onUserLeave:function(userId){
			},
			//有错误
			onError:function(err){
				alert(err);
			}
		});
	BlitzSDK.setup();
}
var callBacks = {
	//本地视频绑定div
	localVideoId:"localVideoId",
	//远端视频绑定div
	remoteVideoId:"remoteVideoId",
	//setup成功,本地视频开始显示
	onSetup: function () {},
	//登陆成功
	onLogined:function(){},
	//加入会话成功
	onJoined:function(){},
	//离开回调,同时登出离开会话
	onLeave:function(){},
	//会话内有用户进入
	onUserEnter:function(userId){},
	//会话内有用户退出
	onUserLeave:function(userId){},
	//有错误
	onError:function(err){}
}
//初始化回调,及音视频显示区域
BlitzSDK.init = function(callbacks){
	if(BlitzSDK.hasInit)
	{
		callbacks.onError('sdk has init');
		return;
	}
	BlitzSDK.callbacks = callbacks;
	BlitzSDK.localVideoId = callbacks.localVideoId;
	BlitzSDK.remoteVideoId = callbacks.remoteVideoId;
	BlitzSDK.hasSetup = false;
	BlitzSDK.hasInit = true;
	BlitzSDK.hasJoin = false;
}
//本地视频创建,暂时不选择设备
BlitzSDK.setup = function(){
	if(BlitzSDK.hasSetup)
	{
		BlitzSDK.callbacks.onError("sdk has setup");
		return;
	}
	// Make sure the browser supports WebRTC
	if(!Janus.isWebrtcSupported()) {
		BlitzSDK.callbacks.onError("browser unsupported");
		return;
	}
	getUserMedia({ audio: true, video: true }, function(stream) {
			if($('#rthevideo').length === 0) {
				$(BlitzSDK.localVideoId).append('<video class="rounded centered" id="rthevideo" width=100 height=75 autoplay/>');
			}
			attachMediaStream($('#rthevideo').get(0), stream);
			$("#rthevideo").get(0).muted = "muted";
			BlitzSDK.localStream = stream;
		    BlitzSDK.hasSetup = true;
		    BlitzSDK.callbacks.onSetup();
		},
		function(err)
		{
			BlitzSDK.callbacks.onError(err);
			Janus.debug("error");
		});
}
//加入会话
BlitzSDK.join = function(uid,pwd,sid,addr)
{
	if(!BlitzSDK.hasInit)
	{
		BlitzSDK.callbacks.onError("login , init first");
		return;
	}
	if(!BlitzSDK.hasSetup)
	{
		BlitzSDK.callbacks.onError("login , setup first");
		return;
	}
	if(BlitzSDK.hasJoin)
	{
		BlitzSDK.callbacks.onError("logined")
		return;
	}
	BlitzSDK.address = addr;
	BlitzSDK.uid = uid;
	BlitzSDK.pwd = pwd;
	BlitzSDK.sid = sid;
	// Create session
	janus = new Janus(
		{
			server: BlitzSDK.address,
			success: function() {
				// Attach to echo test plugin
				janus.attach(
					{
						plugin: "janus.plugin.recordplay",
						success: function(pluginHandle) {
							recordplay = pluginHandle;
							Janus.log("Plugin attached! (" + recordplay.getPlugin() + ", id=" + recordplay.getId() + ")");
							var body = { "request": "join", "name":"test" ,"sid":BlitzSDK.sid,"uid":BlitzSDK.uid,"pwd":BlitzSDK.pwd};
							recordplay.send({"message": body});
							BlitzSDK.hasJoin = true;
							// Prepare the name prompt
						},
						error: function(error) {
							BlitzSDK.callbacks.onError(error);
						},
						onmessage: function(msg, jsep) {
							if(msg["msg"] == "offer")
							{
								var assrc = msg["assrc"];
								var vssrc = msg["vssrc"];
								recordplay.createAnswer(
									{
										stream:BlitzSDK.localStream,
										jsep:jsep,
										// By default, it's sendrecv for audio and video...
										success: function(jsep) {
											Janus.debug(jsep);
											janus.hasOffer = true;
											janus.jsep = jsep;
											var body = { "request": "answer", "name": myname };
											recordplay.send({"message": body, "jsep": jsep});
										},
										error: function(error) {
											BlitzSDK.callbacks.onError(error);
										}
									},assrc,vssrc);
							}
							else if(msg["msg"]=="joined")
							{
								BlitzSDK.callbacks.onJoined();
							}
							else if(msg["msg"]=="join_error")
							{
								BlitzSDK.callbacks.onError("join error");
							}
							else if(msg["msg"]=="logined")
							{
								BlitzSDK.callbacks.onLogined();
							}
							else if(msg["msg"]=="login_error")
							{
								BlitzSDK.callbacks.onError("login error");
							}
							else if(msg["msg"] == "user_enter")
							{
								BlitzSDK.callbacks.onUserEnter(msg["body"]);
							}
							else if(msg["msg"]=="user_leaveuser_leave")
							{
								BlitzSDK.callbacks.onUserLeave(msg["body"]);
							}
						},
						onlocalstream: function(stream) {
							Janus.debug(" ::: Got a remote stream :::");
							Janus.debug(JSON.stringify(stream));

							if($(BlitzSDK.localVideoId).length === 0) {
								$('#rvideobox').append('<video class="rounded centered" id="rthevideo" width=100 height=75 autoplay/>');
							}
							attachMediaStream($('#rthevideo').get(0), stream);
							$("#rthevideo").get(0).muted = "muted";
						},
						onremotestream: function(stream) {

							Janus.debug(" ::: Got a local stream :::");
							Janus.debug(JSON.stringify(stream));
							if($('#lthevideo').length === 0)
								$(BlitzSDK.remoteVideoId).append('<video class="rounded centered" id="lthevideo" width=308 height=212 autoplay/>');
							attachMediaStream($('#lthevideo').get(0), stream);
							$("#rthevideo").get(0).unmuteAudio();

						},
						oncleanup: function() {
							Janus.log(" ::: Got a cleanup notification :::");
						}
					});
			},
			error: function(error) {
				Janus.error(error);
				BlitzSDK.callbacks.onError(error);
			}
		});

}
//登出及离开会话
BlitzSDK.leave= function()
{
	if(BlitzSDK.hasJoin)
	{
		janus.hangup(true);
		janus.detach();
		janus = null;
		BlitzSDK.hasJoin = false;
		BlitzSDK.callbacks.onLeave();
	}
}
//关闭本地资源
BlitzSDK.close=function()
{
	if(BlitzSDK.hasSetup)
	{
		BlitzSDK.localStream = null;
		BlitzSDK.hasSetup = false;
		BlitzSDK.callbacks.onClose();
	}
}
function getUrlParam(name)
{
	var reg = new RegExp("(^|&)"+ name +"=([^&]*)(&|$)"); //构造一个含有目标参数的正则表达式对象
	var r = window.location.search.substr(1).match(reg);  //匹配目标参数
	if (r!=null) return unescape(r[2]); return null; //返回参数值
}

$(document).ready(function() {
	// Initialize the library (all console debuggers enabled)
	Janus.init({debug: "all", callback: function() {
		// Use a button to start the demo
			var uid = getUrlParam("uid");
			var sid = getUrlParam("sid");
			BlitzSDK.init(
				{
					//本地视频绑定div
					localVideoId:"#lvideobox",
					//远端视频绑定div
					remoteVideoId:"#rvideobox",
					//setup成功,本地视频开始显示
					onSetup: function () {
						BlitzSDK.join(uid,"test",sid,server);
					},
					//登陆成功
					onLogined:function(){},
					//加入会话成功
					onJoined:function(){},
					//离开回调,同时登出离开会话
					onLeave:function(){},
					//会话内有用户进入
					onUserEnter:function(userId){
						$('#info').append('user '+ userId+ 'enter <br/>');
					},
					//会话内有用户退出
					onUserLeave:function(userId){
						$('#info').append('user '+ userId+ 'leave <br/>');
					},
					//有错误
					onError:function(err){
						alert(err);
					}
				});
			BlitzSDK.setup();
	}});
});

function stop() {
	// Stop a recording/playout
	$('#stop').unbind('click');
	var stop = { "request": "stop" };
	recordplay.send({"message": stop});
	recordplay.hangup();
}
