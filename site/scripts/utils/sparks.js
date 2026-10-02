const SPARK_COLOURS = ['#ffd700', '#ffc200', '#ffaa00', '#fff4a0'];

export const createSparkSystem = (context) => {
    let sparks = [];

    const spawn = (x, y, {
        count = 20,
        minSpeed = 90,
        maxSpeed = 360,
        minLifetime = 0.55,
        maxLifetime = 0.95,
        minSize = 1.5,
        maxSize = 3.5,
        upwardBias = 90,
        followWorld = false,
    } = {}) => {
        for (let index = 0; index < count; index += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
            sparks.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - upwardBias,
                life: 1,
                lifetime: minLifetime + Math.random() * (maxLifetime - minLifetime),
                size: minSize + Math.random() * (maxSize - minSize),
                color: SPARK_COLOURS[Math.floor(Math.random() * SPARK_COLOURS.length)],
                followWorld,
            });
        }
    };

    const draw = (deltaSeconds = 1 / 60, worldSpeed = 0) => {
        const delta = Math.min(deltaSeconds, 0.05);
        sparks = sparks.filter((spark) => spark.life > 0);
        sparks.forEach((spark) => {
            spark.vy += 900 * delta;
            spark.x += (spark.vx - (spark.followWorld ? worldSpeed : 0)) * delta;
            spark.y += spark.vy * delta;
            spark.life -= delta / spark.lifetime;

            context.globalAlpha = Math.max(0, spark.life);
            context.fillStyle = spark.color;
            context.beginPath();
            context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
            context.fill();
        });
        context.globalAlpha = 1;
    };

    return { spawn, draw };
};
