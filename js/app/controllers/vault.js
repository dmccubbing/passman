/**
 * Nextcloud - passman
 *
 * @copyright Copyright (c) 2016, Sander Brand (brantje@gmail.com)
 * @copyright Copyright (c) 2016, Marcos Zuriaga Miguel (wolfi@wolfi.es)
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

(function () {
	'use strict';

	/**
	 * @ngdoc function
	 * @name passmanApp.controller:MainCtrl
	 * @description
	 * # MainCtrl
	 * Controller of the passmanApp
	 */
	angular.module('passmanApp')
		.controller('VaultCtrl', ['$scope', 'VaultService', 'SettingsService', 'CredentialService', '$location', 'ShareService', 'EncryptService', '$translate', function ($scope, VaultService, SettingsService, CredentialService, $location, ShareService, EncryptService, $translate) {
			VaultService.getVaults().then(function (vaults) {
				$scope.vaults = vaults;
				if (SettingsService.getSetting('defaultVault') != null) {
					var default_vault = SettingsService.getSetting('defaultVault');

					/**
					 * Using a native for loop for preformance reasons.
					 * More info see http://stackoverflow.com/questions/13843972/angular-js-break-foreach
					 */
					for (var i = 0; i < vaults.length; i++) {
						var vault = vaults[i];
						if (vault.guid === default_vault.guid) {
							$scope.default_vault = true;
							$scope.list_selected_vault = vault;
							SettingsService.setSetting('defaultVault', vault);
							if (SettingsService.getSetting('defaultVaultPass')) {
								$location.path('/vault/' + vault.guid);
							}
							break;
						}
					}
				}
			});


			$scope.default_vault = false;
			$scope.remember_vault_password = false;
			$scope.list_selected_vault = false;

			$scope.toggleDefaultVault = function () {
				$scope.default_vault = !$scope.default_vault;
				if ($scope.default_vault === true) {
					SettingsService.setSetting('defaultVault', $scope.list_selected_vault);
				} else {
					SettingsService.setSetting('defaultVault', null);
				}
			};

			$scope.toggleRememberPassword = function () {
				$scope.remember_vault_password = !$scope.remember_vault_password;
				if ($scope.remember_vault_password) {
					SettingsService.setSetting('defaultVault', $scope.list_selected_vault);
					$scope.default_vault = true;
				}
				if ($scope.remember_vault_password !== true) {
					SettingsService.setSetting('defaultVault', null);
				}
			};

			$scope.clearState = function () {
				$scope.list_selected_vault = false;
				$scope.creating_vault = false;
				$scope.error = false;
			};

			$scope.selectVault = function (vault) {
				$scope.list_selected_vault = vault;
			};
			$scope.sharing_keys = {};
			$scope.newVault = function () {
				$scope.creating_vault = true;
				var key_size = 1024;
				ShareService.generateRSAKeys(key_size).progress(function (progress) {
					var p = progress > 0 ? 2 : 1;
					var msg =  $translate.instant('generating.sharing.keys');
					msg = msg.replace('%step', p);
					$scope.creating_keys = msg;
					$scope.$digest();
				}).then(function (kp) {
					var pem = ShareService.rsaKeyPairToPEM(kp);
					$scope.creating_keys = false;
					$scope.sharing_keys.private_sharing_key = pem.privateKey;
					$scope.sharing_keys.public_sharing_key = pem.publicKey;
					$scope.$digest();
				});

			};

			var _loginToVault = function (vault, vault_key) {
				var _vault = angular.copy(vault);
				_vault.vaultKey = angular.copy(vault_key);
				delete _vault.credentials;
				VaultService.setActiveVault(_vault);
				$location.path('/vault/' + vault.guid);
			};

			$scope.vaultDecryptionKey = '';
			$scope.loginToVault = function (vault, vault_key) {
				$scope.error = false;
				var _vault = angular.copy(vault);
				_vault.vaultKey = angular.copy(vault_key);

				VaultService.setActiveVault(_vault);
				try {
					EncryptService.decryptString(vault.challenge_password);
					if ($scope.remember_vault_password) {
						SettingsService.setSetting('defaultVaultPass', vault_key);
					}
					_loginToVault(vault, vault_key);

				} catch (e) {
					$scope.error = $translate.instant('invalid.vault.key')
				}

			};


			$scope.createVault = function (vault_name, vault_key, vault_key2) {
				if (vault_key !== vault_key2) {
					$scope.error = $translate.instant('password.do.not.match');
					return;
				}
				VaultService.createVault(vault_name).then(function (vault) {
					$scope.vaults.push(vault);
					var _vault = angular.copy(vault);
					_vault.vaultKey = angular.copy(vault_key);
					VaultService.setActiveVault(_vault);
					SettingsService.setSetting('defaultVaultPass', null);
					SettingsService.setSetting('defaultVault', null);
					var test_credential = CredentialService.newCredential();
					test_credential.label = 'Test key for vault ' + vault_name;
					test_credential.hidden = true;
					test_credential.vault_id = vault.vault_id;
					test_credential.password = 'lorum ipsum';
					CredentialService.createCredential(test_credential).then(function () {
						_vault.public_sharing_key = angular.copy($scope.sharing_keys.public_sharing_key);
						_vault.private_sharing_key = EncryptService.encryptString(angular.copy($scope.sharing_keys.private_sharing_key));
						VaultService.updateSharingKeys(_vault).then(function () {
							_loginToVault(vault, vault_key);
						});
					});
				});
			};
		}]);
}());