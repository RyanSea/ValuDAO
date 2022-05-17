//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface ISphere {

    function authenticate(uint discord_id, address _address) external;

    function isAuthenticated(uint discord_id) external view returns (bool);

    function powerUp(uint discord_id, uint amount) external;

    function powerDown(uint discord_id, uint amount) external;

    function engage(uint engager_id, uint engagee_id) external;

}