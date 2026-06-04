CREATE INDEX "consumers_owner_idx" ON "consumers" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "usages_server_id_idx" ON "usages" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "usages_client_idx" ON "usages" USING btree ("client");