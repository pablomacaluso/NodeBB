var RDB = require('./redis'),
	async = require('async'),
	user = require('./user');


(function(Messaging) {

	function sortUids(fromuid, touid) {
		var uids = [fromuid, touid];
		uids.sort();
		return uids;
	}

	Messaging.addMessage = function(fromuid, touid, content, callback) {
		var uids = sortUids(fromuid, touid);

		RDB.incr('global:next_message_id', function(err, mid) {
			if (err)
				return callback(err, null);

			var message = {
				content: content,
				timestamp: Date.now(),
				fromuid: fromuid,
				touid: touid
			};

			RDB.hmset('message:' + mid, message);
			RDB.rpush('messages:' + uids[0] + ':' + uids[1], mid);

			Messaging.updateChatTime(fromuid, touid);
			Messaging.updateChatTime(touid, fromuid);
			callback(null, message);
		});
	}

	Messaging.getMessages = function(fromuid, touid, callback) {
		var uids = sortUids(fromuid, touid);

		RDB.lrange('messages:' + uids[0] + ':' + uids[1], 0, -1, function(err, mids) {
			if (err)
				return callback(err, null);

			if (!mids || !mids.length) {
				return callback(null, []);
			}


			user.getUserField(touid, 'username', function(err, tousername) {

				var messages = [];

				function getMessage(mid, next) {
					RDB.hgetall('message:' + mid, function(err, message) {
						if (err)
							return next(err);

						if (message.fromuid === fromuid)
							message.content = 'You : ' + message.content;
						else
							message.content = tousername + ' : ' + message.content;

						messages.push(message);
						next(null);
					});
				}

				async.eachSeries(mids, getMessage, function(err) {
					if (err)
						return callback(err, null);

					callback(null, messages);
				});
			});
		});
	}

	Messaging.updateChatTime = function(uid, toUid, callback) {
		RDB.zadd('uid:' + uid + ':chats', Date.now(), toUid, function(err) {
			if (callback) {
				callback(err);
			}
		});
	};

	Messaging.getRecentChats = function(uid, callback) {
		RDB.zrevrange('uid:' + uid + ':chats', 0, 9, function(err, uids) {
			if (!err) {
				user.getMultipleUserFields(uids, ['username', 'picture', 'uid'], callback);
			} else {
				callback(err);
			}
		});
	};

}(exports));