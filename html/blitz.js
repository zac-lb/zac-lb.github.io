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
    server = "https://" + window.location.hostname + ":8089/janus";

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

function start(uid,sid,pwd)
{
    Janus.init({debug: "all", callback: function() {
        // Use a button to start the demo
            if(started)
                return;
            started = true;
            // Make sure the browser supports WebRTC
            if(!Janus.isWebrtcSupported()) {
                alert("No WebRTC support... ");
                return;
            }
            // Create session
            janus = new Janus(
                {
                    server: server,
                    success: function() {
                        // Attach to echo test plugin
                        janus.attach(
                            {
                                plugin: "janus.plugin.recordplay",
                                success: function(pluginHandle) {
                                    recordplay = pluginHandle;
                                    Janus.log("Plugin attached! (" + recordplay.getPlugin() + ", id=" + recordplay.getId() + ")");
                                    recordplay.createOffer(
                                        {
                                            // By default, it's sendrecv for audio and video...
                                            success: function(jsep) {
                                                Janus.debug("Got SDP!");
                                                Janus.debug(jsep);
                                                var body = { "request": "join", "name": "blitz test" ,"sid":sid,"uid":uid,"pwd":pwd};
                                                recordplay.send({"message": body, "jsep": jsep});
                                            },
                                            error: function(error) {
                                                Janus.error("WebRTC error...", error);
                                                bootbox.alert("WebRTC error... " + error);
                                                recordplay.hangup();
                                            }
                                        });
                                    // Prepare the name prompt
                                },
                                error: function(error) {
                                    Janus.error("  -- Error attaching plugin...", error);
                                },
                                onmessage: function(msg, jsep) {
                                    recordplay.handleRemoteJsep({jsep: jsep});
                                },
                                onlocalstream: function(stream) {


                                    Janus.debug(" ::: Got a remote stream :::");
                                    Janus.debug(JSON.stringify(stream));

                                    if($('#localvideo').length === 0) {
                                        $('#localvideobox').append('<video class="rounded centered" id="localvideo" width=320 height=240 autoplay/>');
                                    }
                                    attachMediaStream($('#localvideo').get(0), stream);
                                    $("#localvideo").get(0).muted = "muted";

                                },
                                onremotestream: function(stream) {

                                    Janus.debug(" ::: Got a local stream :::");
                                    Janus.debug(JSON.stringify(stream));
                                    if($('#remotevideo').length === 0)
                                        $('#remotevideobox').append('<video class="rounded centered" id="remotevideo" width=320 height=240 autoplay/>');
                                    attachMediaStream($('#remotevideo').get(0), stream);

                                },
                                oncleanup: function() {
                                    Janus.log(" ::: Got a cleanup notification :::");
                                }
                            });
                    },
                    error: function(error) {
                        Janus.error(error);
                        bootbox.alert(error);
                    },
                    destroyed: function() {
                        window.location.reload();
                    }
                });
    }});
}

function stop() {
    // Stop a recording/playout
    var stop = { "request": "stop" };
    recordplay.send({"message": stop});
    recordplay.hangup();
}
