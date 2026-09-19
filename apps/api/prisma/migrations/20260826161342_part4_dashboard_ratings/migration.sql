-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('WORKOUT_COUNT', 'TOTAL_KG');

-- CreateEnum
CREATE TYPE "PairGoalStatus" AS ENUM ('PENDING_CONFIRM', 'ACTIVE', 'DONE');

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "weight_kg" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pair_goals" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "due" DATE,
    "status" "PairGoalStatus" NOT NULL DEFAULT 'PENDING_CONFIRM',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pair_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "ratee_id" UUID NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "spotting" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workouts_match_id_date_idx" ON "workouts"("match_id", "date");

-- CreateIndex
CREATE INDEX "ratings_ratee_id_created_at_idx" ON "ratings"("ratee_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_match_id_rater_id_key" ON "ratings"("match_id", "rater_id");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_goals" ADD CONSTRAINT "pair_goals_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratee_id_fkey" FOREIGN KEY ("ratee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
