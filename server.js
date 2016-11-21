var unirest = require('unirest');
var express = require('express');
var events = require('events');

/**
 * API calls to Spotify
 */
var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body, response.code);
                }
                else {
                    emitter.emit('error', response.code);
                }
            });
    return emitter;
};

function getFromRelatedApi(id) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/artists/' + id + '/related-artists')
        .end(function(response) {
            if (response.ok) {
                emitter.emit('end', response.body.artists);
            } else {
                emitter.emit('error', response.code);
            }
        }); 
    return emitter;
};

function getTracks(id) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/artists/' + id + '/top-tracks')
        .qs({ country: 'US' })
        .end(function(response) {
            if (response.ok) {
                debugger;
                emitter.emit('end', response.body.tracks);
            } else {
                debugger;
                emitter.emit('error', response.code);
            }
        }); 
    return emitter;
}

var app = express();
app.use(express.static('public'));

// GET call from the client.
app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item, code) {
        if (item.artists.items.length === 0) {
            res.sendStatus(404);
            return;
        }
        
        var artist = item.artists.items[0];
        
        var searchRelatedReq = getFromRelatedApi(artist.id);
        
        searchRelatedReq.on('end', function(related) {
            artist.related = related;
            
            var completed = 0;
            
            // When all async calls are done, return the results.
            function checkDone() {
                if (completed === artist.related.length) {
                    res.json(artist);
                }
            }
            
            // Run parallel async calls to the server.
            artist.related.forEach(function(artistRel) {
                debugger;
                var searchTracks = getTracks(artistRel.id);
                
                searchTracks.on('end', function(tracks) {
                    artistRel.tracks = tracks;
                    completed++;
                    checkDone();
                });
                
                searchTracks.on('error', function(code) {
                    res.sendStatus(code);
                });
            });
        });
        
        searchRelatedReq.on('error', function(code) {
            res.sendStatus(code);
        });
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(process.env.PORT || 8080);
