import redis from "redis";
export const client = redis.createClient({
    socket: {
        host: 'redis-11919.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 11919
    },
    username: 'default',
    password: "jmjPL7pNzP1R7t1vgFRB2XK1dnWrhbID"
});
client.on("error", (err) => console.error(" Redis Error:", err));
// (async () => {
//     try {
//         await client.connect();
//         console.log("Connected to Redis");
//     } catch (err) {
//         console.error("Redis connection failed:", err);
//     }
// })();
