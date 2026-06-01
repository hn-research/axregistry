CREATE TABLE "consumers" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"stars" integer,
	"list_opt_out" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_crawled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usages" (
	"consumer_id" text NOT NULL,
	"server_id" text NOT NULL,
	"config_path" text NOT NULL,
	"client" text NOT NULL,
	"transport" text,
	"env_keys" jsonb,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usages_consumer_id_server_id_config_path_pk" PRIMARY KEY("consumer_id","server_id","config_path")
);
--> statement-breakpoint
ALTER TABLE "usages" ADD CONSTRAINT "usages_consumer_id_consumers_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."consumers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usages" ADD CONSTRAINT "usages_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;