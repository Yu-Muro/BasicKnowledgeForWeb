output "resource_contract" {
  description = "Production resource names and IDs consumed by Wrangler and deployment checks."
  value       = module.project.resource_contract
}
