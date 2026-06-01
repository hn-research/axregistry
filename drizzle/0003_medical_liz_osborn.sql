CREATE TABLE "adoption_snapshots" (
	"server_id" text NOT NULL,
	"day" date NOT NULL,
	"observed_repos" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "adoption_snapshots_server_id_day_pk" PRIMARY KEY("server_id","day")
);
--> statement-breakpoint
ALTER TABLE "adoption_snapshots" ADD CONSTRAINT "adoption_snapshots_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;