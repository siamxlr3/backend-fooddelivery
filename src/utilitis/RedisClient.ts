import redis from "redis"

export const client=redis.createClient({
    socket: {
        host: 'redis-11919.crce182.ap-south-1-1.ec2.redns.redis-cloud.com',
        port: 11919
    },
    username: 'default',
    password: "jmjPL7pNzP1R7t1vgFRB2XK1dnWrhbID"
});

client.on("error", (err:Error) => console.error("❌ Redis Error:", err));

(async () => {
    await client.connect();
})();


